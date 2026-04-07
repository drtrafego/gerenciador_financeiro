CREATE TABLE IF NOT EXISTS "recurring_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text DEFAULT 'BRL',
  "day_of_month" integer DEFAULT 1,
  "active" text DEFAULT 'true',
  "created_at" timestamp DEFAULT now()
);
