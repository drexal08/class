-- The turn-in window columns were recorded as part of
-- `20260829120000_submission_window`, but that migration is marked applied in
-- environments where the columns were never actually created (the database was
-- originally shaped with `db push`). Add them idempotently so those databases
-- catch up.
ALTER TABLE "Assignment"
  ADD COLUMN IF NOT EXISTS "acceptingSubmissions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowLateSubmissions" BOOLEAN NOT NULL DEFAULT true;
