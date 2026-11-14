-- Submission.fileUrl was superseded by the Attachment table. Keeping it around
-- left two sources of truth for a student's files.
ALTER TABLE "Submission" DROP COLUMN IF EXISTS "fileUrl";

-- A comment and an attachment each belong to exactly one parent. The optional
-- foreign keys alone allow zero parents (orphans) or several at once (a row
-- that appears in unrelated threads), so enforce the XOR in the database.
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_one_parent_check"
  CHECK (
    (("announcementId" IS NOT NULL)::int
     + ("assignmentId" IS NOT NULL)::int
     + ("submissionId" IS NOT NULL)::int) = 1
  );

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_one_parent_check"
  CHECK (
    (("announcementId" IS NOT NULL)::int
     + ("assignmentId" IS NOT NULL)::int
     + ("submissionId" IS NOT NULL)::int) = 1
  );
