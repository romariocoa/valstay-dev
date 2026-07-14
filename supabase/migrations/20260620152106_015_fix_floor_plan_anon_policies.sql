-- Fix floor_plan_config policies to allow anon (app uses custom auth, not Supabase Auth)
DROP POLICY IF EXISTS "select_floor_plan_config" ON floor_plan_config;
DROP POLICY IF EXISTS "insert_floor_plan_config" ON floor_plan_config;
DROP POLICY IF EXISTS "update_floor_plan_config" ON floor_plan_config;
DROP POLICY IF EXISTS "delete_floor_plan_config" ON floor_plan_config;

CREATE POLICY "select_floor_plan_config" ON floor_plan_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_floor_plan_config" ON floor_plan_config FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_floor_plan_config" ON floor_plan_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_floor_plan_config" ON floor_plan_config FOR DELETE TO anon, authenticated USING (true);

-- Fix floor_plan_elements policies too
DROP POLICY IF EXISTS "select_floor_plan_elements" ON floor_plan_elements;
DROP POLICY IF EXISTS "insert_floor_plan_elements" ON floor_plan_elements;
DROP POLICY IF EXISTS "update_floor_plan_elements" ON floor_plan_elements;
DROP POLICY IF EXISTS "delete_floor_plan_elements" ON floor_plan_elements;

CREATE POLICY "select_floor_plan_elements" ON floor_plan_elements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_floor_plan_elements" ON floor_plan_elements FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_floor_plan_elements" ON floor_plan_elements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_floor_plan_elements" ON floor_plan_elements FOR DELETE TO anon, authenticated USING (true);
