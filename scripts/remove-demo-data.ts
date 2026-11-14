import "dotenv/config";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";

import { getStorageConfig } from "../src/lib/env";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Removes the demo data that `prisma/seed.ts` creates.
 *
 * The seed writes into whatever `DATABASE_URL` points at, and this project can
 * point that at the live database. When that happens, fictional people end up
 * in the admin console next to real accounts. This script takes them back out.
 *
 * Only the seed's own rows are touched:
 *
 * - users whose id starts with `dev_` and whose email ends with `@school.edu`
 *   (the seed derives those ids from the email),
 * - the classes those users teach.
 *
 * Real accounts, real classes and every row a real person owns are left
 * alone. Cascades take the demo content with them: topics, assignments,
 * announcements, comments, submissions, rubric marks, attachments and
 * notifications.
 *
 *   npx tsx scripts/remove-demo-data.ts          # dry run — prints the plan
 *   npx tsx scripts/remove-demo-data.ts --apply  # deletes
 */

const apply = process.argv.includes("--apply");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("\n  DATABASE_URL is not set.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const demoUsers = await prisma.user.findMany({
    where: {
      id: { startsWith: "dev_" },
      email: { endsWith: "@school.edu" },
    },
    select: { id: true, email: true, displayName: true, role: true },
    orderBy: { email: "asc" },
  });

  const userIds = demoUsers.map((user) => user.id);

  const demoCourses = await prisma.course.findMany({
    where: { teacherId: { in: userIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const courseIds = demoCourses.map((course) => course.id);

  // A real person enrolled in a demo class would be collateral damage, so the
  // script refuses to run if that ever happens.
  const outsiders = await prisma.enrollment.findMany({
    where: {
      courseId: { in: courseIds },
      userId: { notIn: userIds },
    },
    select: { user: { select: { email: true } }, course: { select: { name: true } } },
  });

  const attachments = await prisma.attachment.findMany({
    where: {
      OR: [
        { uploadedById: { in: userIds } },
        { announcement: { courseId: { in: courseIds } } },
        { assignment: { courseId: { in: courseIds } } },
        { submission: { assignment: { courseId: { in: courseIds } } } },
      ],
    },
    select: { id: true, key: true },
  });

  console.log(`\n  Demo users (${demoUsers.length})`);
  for (const user of demoUsers) {
    console.log(`    ${user.email}  —  ${user.displayName ?? "(no name)"}`);
  }

  console.log(`\n  Demo classes (${demoCourses.length})`);
  for (const course of demoCourses) {
    console.log(`    ${course.name}  (${course.code})`);
  }

  if (outsiders.length > 0) {
    console.error(
      "\n  Refusing to continue: real accounts are enrolled in a demo class.",
    );
    for (const enrollment of outsiders) {
      console.error(`    ${enrollment.user.email} in ${enrollment.course.name}`);
    }
    process.exit(1);
  }

  if (demoUsers.length === 0 && demoCourses.length === 0) {
    console.log("\n  Nothing to remove.\n");
    return;
  }

  if (!apply) {
    console.log(
      `\n  Dry run. ${demoCourses.length} class(es) and ${demoUsers.length} user(s) would be deleted,\n` +
        `  along with ${attachments.length} attachment row(s) and their stored objects.\n` +
        "  Re-run with --apply to do it.\n",
    );
    return;
  }

  // Classes first: a class points at its teacher, and that relationship
  // restricts deletion of the teacher while the class still exists.
  const deletedCourses = await prisma.course.deleteMany({
    where: { id: { in: courseIds } },
  });
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  await deleteObjects(attachments.map((attachment) => attachment.key));

  console.log(
    `\n  Removed ${deletedCourses.count} demo class(es) and ${deletedUsers.count} demo user(s).\n`,
  );
}

/** Deletes the stored objects for the attachments that were removed. */
async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const config = getStorageConfig();
  if (!config) {
    console.warn(
      "  Storage is not configured; the database rows were removed but the stored files were not.",
    );
    return;
  }

  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  for (const key of keys) {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
      );
    } catch (error) {
      console.error(`  Could not delete ${key}:`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
