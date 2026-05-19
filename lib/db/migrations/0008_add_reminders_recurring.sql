ALTER TABLE reminders ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false;
UPDATE reminders SET start_date = trigger_date WHERE start_date IS NULL;
