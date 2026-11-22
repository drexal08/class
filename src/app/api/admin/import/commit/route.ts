import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getSchoolMember } from "@/lib/sdms/access";
import { studentAuthEmail, defaultCohortPassword } from "@/lib/sdms/import-normalization";

const commitSchema = z.object({
  token: z.string().min(1),
  commitKey: z.string().min(1),
  schoolId: z.string().min(1),
  overridePassword: z.string().optional(),
});

function hashToken(token: string): string {
  return createHmac("sha256", process.env.SDMS_SECRET ?? "dev-secret").update(token).digest("hex");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = commitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { token, commitKey, schoolId, overridePassword } = parsed.data;

  const membership = await getSchoolMember(schoolId, user.id);
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only school admins can commit imports" }, { status: 403 });
  }

  const tokenHash = hashToken(token);
  const commitKeyHash = hashToken(commitKey);

  const preview = await prisma.importPreview.findFirst({
    where: {
      tokenHash,
      commitKey: commitKeyHash,
      schoolId,
      expiresAt: { gt: new Date() },
      committedAt: null,
    },
  });

  if (!preview) {
    return NextResponse.json({ error: "Preview not found, expired, or already committed" }, { status: 404 });
  }

  const payload = preview.payload as {
    sheets: Array<{
      label: string;
      grade: string;
      academicYear: { startYear: number; label: string };
      combination: string;
      normalizedCombination: string;
      students: Array<{
        code: string;
        nameAsImported: string;
        displayName: string;
        gender: "MALE" | "FEMALE" | null;
      }>;
    }>;
    cohortPasswordPolicies: Array<{ label: string; passwordPolicy: "DEFAULT" | "CUSTOM"; passwordSeedYear: number }>;
    overridePassword: string | null;
    totalRows: number;
  };

  const adminAuth = await getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 503 });
  }

  const domain = process.env.NEXT_PUBLIC_STUDENT_EMAIL_DOMAIN;
  if (!domain) {
    return NextResponse.json({ error: "Student email domain not configured" }, { status: 503 });
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      for (const sheet of payload.sheets) {
        // Resolve or create combination alias (normalized)
        const combinationAlias = await tx.combinationAlias.upsert({
          where: { schoolId_normalizedAlias: { schoolId, normalizedAlias: sheet.normalizedCombination } },
          create: {
            schoolId,
            combinationId: (await tx.combination.upsert({
              where: { schoolId_name: { schoolId, name: sheet.combination } },
              create: { schoolId, name: sheet.combination, shortName: sheet.combination.slice(0, 20) },
              update: {},
            })).id,
            alias: sheet.combination,
            normalizedAlias: sheet.normalizedCombination,
          },
          update: {},
        });

        const combination = await tx.combination.findUnique({
          where: { id: combinationAlias.combinationId },
        });
        if (!combination) throw new Error("Combination not found after upsert");

        // Resolve or create cohort
        const cohort = await tx.cohort.upsert({
          where: { schoolId_label_academicYear: { schoolId, label: sheet.label, academicYear: sheet.academicYear.startYear } },
          create: {
            schoolId,
            combinationId: combination.id,
            label: sheet.label,
            grade: sheet.grade,
            academicYear: sheet.academicYear.startYear,
            passwordSeedYear: sheet.academicYear.startYear,
            passwordPolicy: overridePassword ? "CUSTOM" : "DEFAULT",
            passwordSetAt: new Date(),
            createdById: user.id,
            ownerId: user.id,
          },
          update: {
            passwordSetAt: new Date(),
            passwordPolicy: overridePassword ? "CUSTOM" : "DEFAULT",
          },
        });

        // Ensure cohort join code exists
        await tx.joinCode.upsert({
          where: { code: `CLS-${cohort.id.slice(-8).toUpperCase()}` },
          create: { code: `CLS-${cohort.id.slice(-8).toUpperCase()}`, kind: "COHORT", schoolId, cohortId: cohort.id },
          update: {},
        });

        const policy = payload.cohortPasswordPolicies.find(p => p.label === sheet.label);
        const cohortPassword = overridePassword ?? defaultCohortPassword(policy?.passwordSeedYear ?? sheet.academicYear.startYear);

        // Batch Firebase user creation (5 at a time)
        const batchSize = 5;
        for (let i = 0; i < sheet.students.length; i += batchSize) {
          const batch = sheet.students.slice(i, i + batchSize);
          await Promise.all(batch.map(async (student) => {
            const email = studentAuthEmail(student.code, domain);
            let firebaseUid: string;

            try {
              const userRecord = await adminAuth.createUser({
                email,
                password: cohortPassword,
                displayName: student.displayName,
                disabled: false,
              });
              firebaseUid = userRecord.uid;
              results.created++;
            } catch (error: unknown) {
              const firebaseError = error as { code?: string };
              if (firebaseError.code === "auth/email-already-exists") {
                // Adopt existing user
                const existing = await adminAuth.getUserByEmail(email);
                await adminAuth.updateUser(existing.uid, {
                  password: cohortPassword,
                  displayName: student.displayName,
                  disabled: false,
                });
                firebaseUid = existing.uid;
                results.updated++;
              } else {
                results.errors.push(`Firebase error for ${student.code}: ${error instanceof Error ? error.message : String(error)}`);
                results.skipped++;
                return;
              }
            }

            // Upsert User
            const upsertedUser = await tx.user.upsert({
              where: { id: firebaseUid },
              create: {
                id: firebaseUid,
                email,
                displayName: student.displayName,
                studentCode: student.code,
                nameAsImported: student.nameAsImported,
                gender: student.gender,
                role: "STUDENT",
                authKind: "CODE",
                platformRole: "USER",
              },
              update: {
                displayName: student.displayName,
                studentCode: student.code,
                nameAsImported: student.nameAsImported,
                gender: student.gender,
                authKind: "CODE",
              },
            });

            // Upsert CohortMember
            const existingMember = await tx.cohortMember.findUnique({
              where: { cohortId_userId: { cohortId: cohort.id, userId: upsertedUser.id } },
            });

            if (existingMember) {
              if (existingMember.status !== "ACTIVE") {
                await tx.cohortMember.update({
                  where: { id: existingMember.id },
                  data: { status: "ACTIVE", lastSignInAt: null, mustChangePassword: true },
                });
              }
            } else {
              await tx.cohortMember.create({
                data: {
                  cohortId: cohort.id,
                  userId: upsertedUser.id,
                  status: "ACTIVE",
                  mustChangePassword: true,
                },
              });
            }
          }));
        }

        // Mark absent students as LEFT
        const importedCodes = new Set(sheet.students.map(s => s.code));
        const absentMembers = await tx.cohortMember.findMany({
          where: { cohortId: cohort.id, status: "ACTIVE", user: { studentCode: { notIn: Array.from(importedCodes) } } },
          select: { id: true },
        });
        if (absentMembers.length > 0) {
          await tx.cohortMember.updateMany({
            where: { id: { in: absentMembers.map((m: { id: string }) => m.id) } },
            data: { status: "LEFT" },
          });
        }

        // Record import
        await tx.cohortImport.create({
          data: {
            cohortId: cohort.id,
            schoolId,
            fileName: preview.fileName,
            fileHash: preview.fileHash,
            importedById: user.id,
            rows: sheet.students.length,
            created: results.created,
            updated: results.updated,
            skipped: results.skipped,
            warnings: [],
            passwordPolicy: policy?.passwordPolicy ?? "DEFAULT",
          },
        });

        // Create homeroom course if not exists
        const existingHomeroom = await tx.course.findFirst({
          where: { cohortId: cohort.id, kind: "HOMEROOM" },
        });
        let homeroom = existingHomeroom;
        if (!homeroom) {
          homeroom = await tx.course.create({
            data: {
              cohortId: cohort.id,
              schoolId,
              kind: "HOMEROOM",
              name: cohort.label,
              code: `HR-${cohort.id.slice(-8).toUpperCase()}`,
              teacherId: user.id,
              subject: undefined,
            },
          });
        } else {
          await tx.course.update({
            where: { id: homeroom.id },
            data: { teacherId: user.id },
          });
        }

        // Sync enrollments for homeroom
        const activeMembers = await tx.cohortMember.findMany({
          where: { cohortId: cohort.id, status: "ACTIVE" },
          select: { userId: true },
        });
        await Promise.all(activeMembers.map((m: { userId: string }) =>
          tx.enrollment.upsert({
            where: { userId_courseId: { userId: m.userId, courseId: homeroom.id } },
            create: { userId: m.userId, courseId: homeroom.id, role: "STUDENT", active: true },
            update: { active: true },
          })
        ));

        // Teacher enrollment for homeroom
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: user.id, courseId: homeroom.id } },
          create: { userId: user.id, courseId: homeroom.id, role: "TEACHER", active: true },
          update: { active: true, role: "TEACHER" },
        });
      }

      // Mark preview as committed
      await tx.importPreview.update({
        where: { id: preview.id },
        data: { committedAt: new Date() },
      });

      // Audit
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: user.id,
          action: "COHORT_IMPORT_COMMITTED",
          targetType: "CohortImport",
          targetId: null,
          metadata: { totalCreated: results.created, totalUpdated: results.updated, totalSkipped: results.skipped },
        },
      });
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error("[import-commit] Error:", error);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}