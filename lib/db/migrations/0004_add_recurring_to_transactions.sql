ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "is_recurring" text DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS "recurring_active" text DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS "recurring_ends_at" date;
