ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_test" boolean DEFAULT false NOT NULL;
