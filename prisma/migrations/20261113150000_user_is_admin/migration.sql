-- Administrators become an overlay instead of a third role.
--
-- `role` keeps its LMS meaning (student or teacher); a separate `isAdmin`
-- flag unlocks the admin console. Existing ADMIN accounts keep their
-- administrator rights through the new flag and fall back to the student
-- role in classes, which is what the accounts were before they were promoted.

-- AlterEnum
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Carry the administrator rights over before the enum loses its ADMIN value.
UPDATE "User" SET "isAdmin" = true WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'STUDENT' WHERE "role" = 'ADMIN';
UPDATE "Enrollment" SET "role" = 'STUDENT' WHERE "role" = 'ADMIN';

-- Rebuild the enum without its ADMIN value.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Enrollment" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT;
ALTER TABLE "Enrollment" ALTER COLUMN "role" TYPE TEXT;
DROP TYPE "Role";
CREATE TYPE "Role" AS ENUM ('TEACHER', 'STUDENT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "Enrollment" ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
ALTER TABLE "Enrollment" ALTER COLUMN "role" SET DEFAULT 'STUDENT';

-- CreateIndex
CREATE INDEX "User_isAdmin_idx" ON "User"("isAdmin");

-- The submission-window columns added by 20260829120000_submission_window are
-- not part of the schema and were never used by the application, so they go
-- away here rather than lingering as drift.
ALTER TABLE "Assignment" DROP COLUMN "acceptingSubmissions",
DROP COLUMN "allowLateSubmissions";
