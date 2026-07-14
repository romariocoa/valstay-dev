-- Drop existing policies
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_insert" ON rooms;
DROP POLICY IF EXISTS "rooms_update" ON rooms;
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
DROP POLICY IF EXISTS "guests_select" ON guests;
DROP POLICY IF EXISTS "guests_insert" ON guests;
DROP POLICY IF EXISTS "guests_update" ON guests;
DROP POLICY IF EXISTS "guests_delete" ON guests;
DROP POLICY IF EXISTS "stays_select" ON stays;
DROP POLICY IF EXISTS "stays_insert" ON stays;
DROP POLICY IF EXISTS "stays_update" ON stays;
DROP POLICY IF EXISTS "stays_delete" ON stays;

-- Create new policies for anon access
CREATE POLICY "rooms_select" ON rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "guests_select" ON guests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "guests_insert" ON guests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "guests_update" ON guests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "guests_delete" ON guests FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "stays_select" ON stays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "stays_insert" ON stays FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "stays_update" ON stays FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stays_delete" ON stays FOR DELETE TO anon, authenticated USING (true);