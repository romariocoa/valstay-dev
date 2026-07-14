CREATE TABLE IF NOT EXISTS floor_plan_config (
  floor integer PRIMARY KEY,
  cols  integer NOT NULL DEFAULT 22,
  rows  integer NOT NULL DEFAULT 14
);

ALTER TABLE floor_plan_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_floor_plan_config" ON floor_plan_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_floor_plan_config" ON floor_plan_config
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_floor_plan_config" ON floor_plan_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_floor_plan_config" ON floor_plan_config
  FOR DELETE TO authenticated USING (true);