-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "acceptingSubmissions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true;
