-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPERUSER');

-- CreateEnum
CREATE TYPE "SchoolRole" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "SchoolMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'MOVED', 'LEFT');

-- CreateEnum
CREATE TYPE "CourseKind" AS ENUM ('HOMEROOM', 'SUBJECT');

-- CreateEnum
CREATE TYPE "JoinCodeKind" AS ENUM ('SCHOOL', 'COHORT', 'COURSE');

-- CreateEnum
CREATE TYPE "PasswordPolicy" AS ENUM ('DEFAULT', 'CUSTOM');

-- DropIndex
DROP INDEX "Term_isActive_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "authKind" TEXT NOT NULL DEFAULT 'GOOGLE',
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastSignInAt" TIMESTAMP(3),
ADD COLUMN     "nameAsImported" TEXT,
ADD COLUMN     "passwordOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "studentCode" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "cohortId" TEXT,
ADD COLUMN     "kind" "CourseKind" NOT NULL DEFAULT 'SUBJECT',
ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "leftAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "overrides" JSONB;

-- AlterTable
ALTER TABLE "Term" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL DEFAULT 'TEACHER',
    "status" "SchoolMemberStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolInvite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT,
    "role" "SchoolRole" NOT NULL DEFAULT 'TEACHER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "JoinCodeKind" NOT NULL,
    "schoolId" TEXT,
    "cohortId" TEXT,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combination" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "stream" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Combination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombinationAlias" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,

    CONSTRAINT "CombinationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "combinationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "rawGrade" TEXT,
    "academicYear" INTEGER NOT NULL,
    "passwordSeedYear" INTEGER NOT NULL,
    "passwordPolicy" "PasswordPolicy" NOT NULL DEFAULT 'DEFAULT',
    "passwordSetAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMember" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "claimedAt" TIMESTAMP(3),
    "claimedIpHash" TEXT,
    "lastSignInAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPreview" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "commitKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortImport" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedById" TEXT,
    "rows" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "updated" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "warnings" JSONB NOT NULL,
    "passwordPolicy" "PasswordPolicy" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'firebase',
    "projectId" TEXT NOT NULL,
    "providerUid" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDispute" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "ipHash" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE INDEX "School_isLegacy_idx" ON "School"("isLegacy");

-- CreateIndex
CREATE INDEX "School_disabledAt_idx" ON "School"("disabledAt");

-- CreateIndex
CREATE INDEX "SchoolMember_userId_status_idx" ON "SchoolMember"("userId", "status");

-- CreateIndex
CREATE INDEX "SchoolMember_schoolId_role_status_idx" ON "SchoolMember"("schoolId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMember_schoolId_userId_key" ON "SchoolMember"("schoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolInvite_tokenHash_key" ON "SchoolInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SchoolInvite_schoolId_email_idx" ON "SchoolInvite"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "JoinCode_code_key" ON "JoinCode"("code");

-- CreateIndex
CREATE INDEX "JoinCode_kind_idx" ON "JoinCode"("kind");

-- CreateIndex
CREATE INDEX "JoinCode_schoolId_idx" ON "JoinCode"("schoolId");

-- CreateIndex
CREATE INDEX "JoinCode_cohortId_idx" ON "JoinCode"("cohortId");

-- CreateIndex
CREATE INDEX "JoinCode_courseId_idx" ON "JoinCode"("courseId");

-- CreateIndex
CREATE INDEX "Combination_schoolId_idx" ON "Combination"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Combination_schoolId_name_key" ON "Combination"("schoolId", "name");

-- CreateIndex
CREATE INDEX "CombinationAlias_combinationId_idx" ON "CombinationAlias"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "CombinationAlias_schoolId_normalizedAlias_key" ON "CombinationAlias"("schoolId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "Cohort_schoolId_academicYear_idx" ON "Cohort"("schoolId", "academicYear");

-- CreateIndex
CREATE INDEX "Cohort_combinationId_idx" ON "Cohort"("combinationId");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_schoolId_label_academicYear_key" ON "Cohort"("schoolId", "label", "academicYear");

-- CreateIndex
CREATE INDEX "CohortMember_userId_status_idx" ON "CohortMember"("userId", "status");

-- CreateIndex
CREATE INDEX "CohortMember_cohortId_status_idx" ON "CohortMember"("cohortId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMember_cohortId_userId_key" ON "CohortMember"("cohortId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportPreview_tokenHash_key" ON "ImportPreview"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ImportPreview_commitKey_key" ON "ImportPreview"("commitKey");

-- CreateIndex
CREATE INDEX "ImportPreview_schoolId_createdById_expiresAt_idx" ON "ImportPreview"("schoolId", "createdById", "expiresAt");

-- CreateIndex
CREATE INDEX "CohortImport_cohortId_createdAt_idx" ON "CohortImport"("cohortId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_projectId_providerUid_key" ON "AuthIdentity"("provider", "projectId", "providerUid");

-- CreateIndex
CREATE INDEX "ClaimDispute_memberId_resolvedAt_idx" ON "ClaimDispute"("memberId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ClaimDispute_code_idx" ON "ClaimDispute"("code");

-- CreateIndex
CREATE INDEX "AssignmentGroup_schoolId_idx" ON "AssignmentGroup"("schoolId");

-- CreateIndex
CREATE INDEX "LoginAttempt_codeHash_createdAt_idx" ON "LoginAttempt"("codeHash", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_schoolId_createdAt_idx" ON "AuditEvent"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentCode_key" ON "User"("studentCode");

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

-- CreateIndex
CREATE INDEX "User_archivedAt_idx" ON "User"("archivedAt");

-- CreateIndex
CREATE INDEX "Course_schoolId_idx" ON "Course"("schoolId");

-- CreateIndex
CREATE INDEX "Course_cohortId_idx" ON "Course"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_cohortId_subject_kind_key" ON "Course"("cohortId", "subject", "kind");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_active_idx" ON "Enrollment"("courseId", "active");

-- CreateIndex
CREATE INDEX "Assignment_groupId_idx" ON "Assignment"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_groupId_courseId_key" ON "Assignment"("groupId", "courseId");

-- CreateIndex
CREATE INDEX "Term_schoolId_isActive_idx" ON "Term"("schoolId", "isActive");

-- AddForeignKey
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMember" ADD CONSTRAINT "SchoolMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolInvite" ADD CONSTRAINT "SchoolInvite_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinCode" ADD CONSTRAINT "JoinCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinCode" ADD CONSTRAINT "JoinCode_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinCode" ADD CONSTRAINT "JoinCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Combination" ADD CONSTRAINT "Combination_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinationAlias" ADD CONSTRAINT "CombinationAlias_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "Combination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "Combination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportPreview" ADD CONSTRAINT "ImportPreview_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortImport" ADD CONSTRAINT "CohortImport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortImport" ADD CONSTRAINT "CohortImport_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDispute" ADD CONSTRAINT "ClaimDispute_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CohortMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentGroup" ADD CONSTRAINT "AssignmentGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssignmentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- SDMS invariants not expressible in Prisma's schema syntax.
CREATE UNIQUE INDEX "Term_schoolId_academicYear_name_key"
  ON "Term"("schoolId", "academicYear", "name");
DROP INDEX IF EXISTS "Term_academicYear_name_key";

CREATE UNIQUE INDEX "Course_one_homeroom_per_cohort"
  ON "Course"("cohortId")
  WHERE "kind" = 'HOMEROOM' AND "cohortId" IS NOT NULL;

CREATE UNIQUE INDEX "JoinCode_one_per_school"
  ON "JoinCode"("schoolId") WHERE "kind" = 'SCHOOL';
CREATE UNIQUE INDEX "JoinCode_one_per_cohort"
  ON "JoinCode"("cohortId") WHERE "kind" = 'COHORT';
CREATE UNIQUE INDEX "JoinCode_one_per_course"
  ON "JoinCode"("courseId") WHERE "kind" = 'COURSE';

-- Expand/backfill: all tenant columns stay nullable in this release so the old
-- deployment can continue writing while the new version is built and verified.
INSERT INTO "School" ("id", "name", "slug", "isLegacy", "requiresApproval")
VALUES ('school_legacy', 'Legacy', 'legacy', true, true)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Course"
SET "schoolId" = (SELECT "id" FROM "School" WHERE "slug" = 'legacy')
WHERE "schoolId" IS NULL;

UPDATE "Term"
SET "schoolId" = (SELECT "id" FROM "School" WHERE "slug" = 'legacy')
WHERE "schoolId" IS NULL;

INSERT INTO "SchoolMember" (
  "id", "schoolId", "userId", "role", "status", "requestedAt", "decidedAt"
)
SELECT
  'legacy_teacher_' || md5("teacherId"),
  (SELECT "id" FROM "School" WHERE "slug" = 'legacy'),
  "teacherId", 'TEACHER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "teacherId" FROM "Course") AS "Teachers"
ON CONFLICT ("schoolId", "userId") DO NOTHING;

INSERT INTO "SchoolMember" (
  "id", "schoolId", "userId", "role", "status", "requestedAt", "decidedAt"
)
SELECT
  'legacy_admin_' || md5("id"),
  (SELECT "id" FROM "School" WHERE "slug" = 'legacy'),
  "id", 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "isAdmin" = true
ON CONFLICT ("schoolId", "userId") DO UPDATE
SET "role" = 'ADMIN', "status" = 'ACTIVE', "decidedAt" = CURRENT_TIMESTAMP;

INSERT INTO "JoinCode" ("id", "code", "kind", "schoolId")
SELECT 'joincode_legacy_school', 'SCH-LEGACY', 'SCHOOL', "id"
FROM "School" WHERE "slug" = 'legacy'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "AuditEvent" (
  "id", "schoolId", "actorId", "action", "targetType", "targetId", "metadata"
)
SELECT
  'audit_legacy_backfill', "id", NULL, 'LEGACY_BACKFILL', 'School', "id",
  jsonb_build_object(
    'courses', (SELECT count(*) FROM "Course" WHERE "schoolId" = "School"."id"),
    'terms', (SELECT count(*) FROM "Term" WHERE "schoolId" = "School"."id")
  )
FROM "School" WHERE "slug" = 'legacy'
ON CONFLICT ("id") DO NOTHING;
