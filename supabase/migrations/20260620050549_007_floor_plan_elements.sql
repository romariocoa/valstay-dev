CREATE TABLE IF NOT EXISTS floor_plan_elements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  floor integer NOT NULL,
  pos_x integer NOT NULL,
  pos_y integer NOT NULL,
  element_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fpe_type_check CHECK (element_type IN ('wall', 'stairs', 'elevator')),
  CONSTRAINT fpe_unique UNIQUE (floor, pos_x, pos_y)
);

ALTER TABLE floor_plan_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpe_select" ON floor_plan_elements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fpe_insert" ON floor_plan_elements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "fpe_update" ON floor_plan_elements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fpe_delete" ON floor_plan_elements FOR DELETE TO anon, authenticated USING (true);