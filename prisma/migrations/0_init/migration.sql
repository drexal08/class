-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM ('ASSIGNED', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('ASSIGNMENT', 'QUIZ', 'QUESTION', 'MATERIAL');

-- CreateEnum
CREATE TYPE "PostPolicy" AS ENUM ('STUDENTS_CAN_POST_AND_COMMENT', 'STUDENTS_CAN_COMMENT_ONLY', 'ONLY_TEACHERS');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT_POSTED', 'COMMENT_ADDED', 'ASSIGNMENT_CREATED', 'WORK_SUBMITTED', 'GRADE_RETURNED', 'ENROLLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkPath" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" TEXT,
    "subject" TEXT,
    "room" TEXT,
    "code" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accent" TEXT NOT NULL DEFAULT 'slate',
    "description" TEXT,
    "postPolicy" "PostPolicy" NOT NULL DEFAULT 'STUDENTS_CAN_POST_AND_COMMENT',

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "maxPoints" INTEGER NOT NULL DEFAULT 100,
    "courseId" TEXT NOT NULL,
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "AssignmentType" NOT NULL DEFAULT 'ASSIGNMENT',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 10,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricScore" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RubricScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "SubmissionState" NOT NULL DEFAULT 'ASSIGNED',
    "grade" DOUBLE PRECISION,
    "feedback" TEXT,
    "fileUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT,
    "gradedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "announcementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentId" TEXT,
    "submissionId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "announcementId" TEXT,
    "assignmentId" TEXT,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_courseId_idx" ON "Notification"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Course_archived_idx" ON "Course"("archived");

-- CreateIndex
CREATE INDEX "Enrollment_courseId_idx" ON "Enrollment"("courseId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_courseId_key" ON "Enrollment"("userId", "courseId");

-- CreateIndex
CREATE INDEX "Topic_courseId_sortOrder_idx" ON "Topic"("courseId", "sortOrder");

-- CreateIndex
CREATE INDEX "Announcement_courseId_createdAt_idx" ON "Announcement"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- CreateIndex
CREATE INDEX "Assignment_courseId_createdAt_idx" ON "Assignment"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_topicId_idx" ON "Assignment"("topicId");

-- CreateIndex
CREATE INDEX "RubricCriterion_assignmentId_sortOrder_idx" ON "RubricCriterion"("assignmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "RubricScore_criterionId_idx" ON "RubricScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricScore_submissionId_criterionId_key" ON "RubricScore"("submissionId", "criterionId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_assignmentId_status_idx" ON "Submission"("assignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_assignmentId_studentId_key" ON "Submission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "Comment_announcementId_createdAt_idx" ON "Comment"("announcementId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_assignmentId_createdAt_idx" ON "Comment"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_submissionId_createdAt_idx" ON "Comment"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Attachment_announcementId_idx" ON "Attachment"("announcementId");

-- CreateIndex
CREATE INDEX "Attachment_assignmentId_idx" ON "Attachment"("assignmentId");

-- CreateIndex
CREATE INDEX "Attachment_submissionId_idx" ON "Attachment"("submissionId");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricScore" ADD CONSTRAINT "RubricScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricScore" ADD CONSTRAINT "RubricScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

