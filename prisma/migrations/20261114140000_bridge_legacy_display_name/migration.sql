-- The name a clabridge student had in the standalone app, so the import can
-- show who a staged row belongs to and fill in an empty display name when
-- the student claims their import.
ALTER TABLE "BridgeLegacyStudent" ADD COLUMN "displayName" TEXT;
