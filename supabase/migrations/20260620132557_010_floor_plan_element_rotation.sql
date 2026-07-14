ALTER TABLE floor_plan_elements
  ADD COLUMN IF NOT EXISTS rotation integer NOT NULL DEFAULT 0;