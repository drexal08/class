"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  AuthError,
  requireActiveCourseManager,
  requireAssignmentManager,
  requireUser,
  runAction,
} from "@/lib/auth/guards";
import { requireSchoolAdmin } from "@/lib/sdms/access";
import { notifyCourse } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish } from "@/lib/realtime/server";
import { deleteObject } from "@/lib/storage/s3";
import type { ActionState } from "@/lib/types";
import {
  createAssignmentGroupSchema,
  createAssignmentSchema,
  createTopicSchema,
  firstIssue,
  rubricCriterionSchema,
} from "@/lib/validators";

/** The topic select submits "none" rather than "", which Radix disallows. */
function normaliseTopicId(value: FormDataEntryValue | null): string | undefined {
  const topicId = typeof value === "string" ? value.trim() : "";
  return topicId && topicId !== "none" ? topicId : undefined;
}

type RubricInput = { title: string; description?: string; points: number };

/**
 * Reads the parallel rubric inputs and validates them with the same schema the
 * API uses, rather than trusting `Number(...)` on arbitrary form values.
 */
function parseRubric(formData: FormData):
  | { rubric: RubricInput[] }
  | { error: string } {
  const titles = formData.getAll("rubricTitle").map(String);
  const points = formData.getAll("rubricPoints").map(String);
  const descriptions = formData.getAll("rubricDescription").map(String);

  const rows = titles
    .map((title, index) => ({
      title,
      description: descriptions[index] ?? "",
      points: points[index] ?? "10",
    }))
    .filter((row) => row.title.trim().length > 0);

  const parsed = z.array(rubricCriterionSchema).safeParse(rows);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  return { rubric: parsed.data };
}

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createAssignmentSchema.safeParse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type") ?? "ASSIGNMENT",
      maxPoints: formData.get("maxPoints") ?? 100,
      dueDate: formData.get("dueDate"),
      // "none" is the select's sentinel for "no topic".
      topicId: normaliseTopicId(formData.get("topicId")),
      published: formData.get("published") !== "false",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, topicId, ...data } = parsed.data;
    const context = await requireActiveCourseManager(courseId);

    // A topic from another course would silently re-parent the assignment.
    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    const rubric = parseRubric(formData);
    if ("error" in rubric) return { error: rubric.error };

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        topicId: topicId ?? null,
        title: data.title,
        description: data.description ?? null,
        type: data.type,
        maxPoints: data.maxPoints,
        dueDate: data.dueDate ?? null,
        published: data.published,
        rubric: {
          create: rubric.rubric.map((criterion, index) => ({
            title: criterion.title,
            description: criterion.description ?? null,
            points: criterion.points,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath(`/course/${courseId}/classwork`);
    await publish(courseChannel(courseId), "assignment:new", {
      actorId: context.user.id,
      id: assignment.id,
    });

    if (data.published) {
      await notifyCourse({
        courseId,
        type: "ASSIGNMENT_CREATED",
        title: `New classwork: ${data.title}`,
        body: data.dueDate
          ? `Due ${data.dueDate.toLocaleDateString()}`
          : undefined,
        linkPath: `/course/${courseId}/classwork/${assignment.id}`,
        actorId: context.user.id,
      });
    }
  });
}

export async function updateAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const assignmentId = String(formData.get("assignmentId") ?? "");
    const parsed = createAssignmentSchema.safeParse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type") ?? "ASSIGNMENT",
      maxPoints: formData.get("maxPoints") ?? 100,
      dueDate: formData.get("dueDate"),
      // "none" is the select's sentinel for "no topic".
      topicId: normaliseTopicId(formData.get("topicId")),
      published: formData.get("published") !== "false",
      acceptingSubmissions: formData
        .getAll("acceptingSubmissions")
        .includes("true"),
      allowLateSubmissions: formData.getAll("allowLateSubmissions").includes("true"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, topicId, ...data } = parsed.data;
    await requireAssignmentManager(courseId, assignmentId);

    if (topicId) {
      const owned = await prisma.topic.count({ where: { id: topicId, courseId } });
      if (!owned) return { error: "That topic belongs to another class" };
    }

    const rubric = parseRubric(formData);
    if ("error" in rubric) return { error: rubric.error };

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      await tx.assignment.updateMany({
        where: { id: assignmentId, courseId },
        data: {
          title: data.title,
          description: data.description ?? null,
          type: data.type,
          maxPoints: data.maxPoints,
          dueDate: data.dueDate ?? null,
          published: data.published,
          acceptingSubmissions: data.acceptingSubmissions,
          allowLateSubmissions: data.allowLateSubmissions,
          topicId: topicId ?? null,
        },
      });

      // Rubric criteria are replaced as a set. Existing marks are tied to the
      // old criteria and are removed with them; the edit form warns about this.
      await tx.rubricCriterion.deleteMany({ where: { assignmentId } });
      if (rubric.rubric.length > 0) {
        await tx.rubricCriterion.createMany({
          data: rubric.rubric.map((criterion, index) => ({
            assignmentId,
            title: criterion.title,
            description: criterion.description ?? null,
            points: criterion.points,
            sortOrder: index,
          })),
        });
      }
    });

    revalidatePath(`/course/${courseId}/classwork`);
    revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
  });
}

export async function deleteAssignmentAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  const result = await runAction(async () => {
    await requireAssignmentManager(courseId, assignmentId);

    const attachments = await prisma.attachment.findMany({
      where: { assignmentId, assignment: { courseId } },
      select: { key: true },
    });

    await prisma.assignment.deleteMany({ where: { id: assignmentId, courseId } });
    await Promise.all(
      attachments.map((attachment: { key: string }) => deleteObject(attachment.key)),
    );

    revalidatePath(`/course/${courseId}/classwork`);
  });

  if (result.error) return result;
  redirect(`/course/${courseId}/classwork`);
}

export async function setAssignmentPublishedAction(
  courseId: string,
  assignmentId: string,
  published: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAssignmentManager(courseId, assignmentId);

    await prisma.assignment.updateMany({
      where: { id: assignmentId, courseId },
      data: { published },
    });

    revalidatePath(`/course/${courseId}/classwork`);
  });
}

export async function createTopicAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createTopicSchema.safeParse({
      courseId: formData.get("courseId"),
      name: formData.get("name"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, name } = parsed.data;
    await requireActiveCourseManager(courseId);

    // New topics append to the end of the list.
    const last = await prisma.topic.findFirst({
      where: { courseId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await prisma.topic.create({
      data: { courseId, name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });

    revalidatePath(`/course/${courseId}/classwork`);
  });
}

/**
 * Creates an AssignmentGroup with copies for each target course.
 * Mode "ANNOUNCEMENT" creates announcement-only copies (no marks, no GradeItem).
 * Mode "SHARED_WORK" creates full assignments with grade items.
 */
export async function createAssignmentGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createAssignmentGroupSchema.safeParse({
      schoolId: formData.get("schoolId"),
      title: formData.get("title"),
      subject: formData.get("subject"),
      mode: formData.get("mode") ?? "SINGLE",
      targetCohortIds: formData.getAll("targetCohortIds").map(String),
      targetCourseIds: formData.getAll("targetCourseIds").map(String),
      description: formData.get("description"),
      type: formData.get("type") ?? "ASSIGNMENT",
      maxPoints: formData.get("maxPoints") ?? 100,
      dueDate: formData.get("dueDate"),
      topicId: formData.get("topicId") ?? undefined,
      published: formData.get("published") !== "false",
      acceptingSubmissions: formData.get("acceptingSubmissions") !== "false",
      allowLateSubmissions: formData.get("allowLateSubmissions") !== "false",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const user = await requireUser();
    if (user.role === "STUDENT") throw new AuthError("Only teachers can create classwork");

    const { schoolId, title, subject, mode, targetCohortIds, targetCourseIds, description, type, maxPoints, dueDate, topicId, published, acceptingSubmissions, allowLateSubmissions } = parsed.data;

    // Resolve target courses
    let courses: Array<{ id: string; cohortId: string | null; schoolId: string | null }> = [];

    if (targetCohortIds.length > 0) {
      const cohortCourses = await prisma.course.findMany({
        where: {
          cohortId: { in: targetCohortIds },
          archived: false,
        },
        select: { id: true, cohortId: true, schoolId: true },
      });
      courses.push(...cohortCourses);
    }

    if (targetCourseIds.length > 0) {
      const directCourses = await prisma.course.findMany({
        where: {
          id: { in: targetCourseIds },
          archived: false,
        },
        select: { id: true, cohortId: true, schoolId: true },
      });
      // Deduplicate
      const existingIds = new Set(courses.map(c => c.id));
      for (const c of directCourses) {
        if (!existingIds.has(c.id)) courses.push(c);
      }
    }

    if (courses.length === 0) {
      return { error: "No target courses found" };
    }

    // Verify all courses belong to the same school (or are global)
    const schoolIds = new Set(courses.map(c => c.schoolId).filter(Boolean));
    if (schoolIds.size > 1) {
      return { error: "All target courses must belong to the same school" };
    }
    const targetSchoolId = schoolIds.values().next().value ?? schoolId;

    // Verify user has access to all target courses
    for (const course of courses) {
      const access = await prisma.course.findUnique({
        where: { id: course.id },
        select: { teacherId: true, schoolId: true },
      });
      if (!access) return { error: `Course ${course.id} not found` };
      const isTeacher = access.teacherId === user.id;
      const isSchoolAdmin = access.schoolId
        ? await prisma.schoolMember.findFirst({ where: { schoolId: access.schoolId, userId: user.id, role: "ADMIN", status: "ACTIVE" } })
        : false;
      if (!isTeacher && !isSchoolAdmin && user.platformRole !== "SUPERUSER") {
        return { error: `You do not have permission to post to course ${course.id}` };
      }
    }

    // Validate topicIds for each course (topics are course-specific)
    if (topicId) {
      for (const course of courses) {
        const topic = await prisma.topic.findUnique({ where: { id: topicId } });
        if (!topic || topic.courseId !== course.id) {
          return { error: `Topic ${topicId} does not belong to course ${course.id}` };
        }
      }
    }

    // Create AssignmentGroup and copies in a transaction
    const rubric = parseRubric(formData);
    if ("error" in rubric) return { error: rubric.error };

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      const group = await tx.assignmentGroup.create({
        data: {
          schoolId: targetSchoolId,
          title,
          subject: subject ?? null,
          mode,
          description: description ?? null,
          type,
          maxPoints,
          dueDate: dueDate ?? null,
          published,
          acceptingSubmissions,
          allowLateSubmissions,
          createdById: user.id,
        },
      });

      for (const course of courses) {
        const assignment = await tx.assignment.create({
          data: {
            groupId: group.id,
            courseId: course.id,
            topicId: topicId ?? null,
            title,
            description: description ?? null,
            type,
            maxPoints,
            dueDate: dueDate ?? null,
            published,
            acceptingSubmissions,
            allowLateSubmissions,
            rubric: {
              create: rubric.rubric.map((criterion, index) => ({
                title: criterion.title,
                description: criterion.description ?? null,
                points: criterion.points,
                sortOrder: index,
              })),
            },
            overrides: {
              create: {
                // Per-class overrides can be added later
              },
            },
          },
          select: { id: true },
        });

        // For SHARED_WORK mode, ensure grade item exists
        if (mode === "SHARED_WORK" && published) {
          // Get or create a default term/category for this school
          const term = await tx.term.findFirst({
            where: { schoolId: targetSchoolId, isActive: true },
            select: { id: true },
          });
          if (term) {
            let category = await tx.gradeCategory.findFirst({
              where: { termId: term.id, courseId: course.id },
              select: { id: true },
            });
            if (!category) {
              category = await tx.gradeCategory.create({
                data: { termId: term.id, courseId: course.id, name: "Assignments", weight: 100 },
              });
            }
            await tx.gradeItem.upsert({
              where: { assignmentId: assignment.id },
              create: {
                assignmentId: assignment.id,
                courseId: course.id,
                termId: term.id,
                categoryId: category.id,
                title,
                maximum: maxPoints,
                assessedOn: new Date(),
              },
              update: { maximum: maxPoints },
            });
          }
        }

        // Notify
        if (published) {
          const enrollments = await tx.enrollment.findMany({
            where: { courseId: course.id, active: true },
            select: { userId: true },
          });
          await Promise.all(enrollments.map((e) =>
            tx.notification.create({
              data: {
                userId: e.userId,
                courseId: course.id,
                type: "ASSIGNMENT_CREATED",
                title: `New classwork: ${title}`,
                body: dueDate ? `Due ${dueDate.toLocaleDateString()}` : undefined,
                linkPath: `/course/${course.id}/classwork/${assignment.id}`,
              },
            })
          ));
        }
      }

      revalidatePath("/dashboard");
    });
  });
}
