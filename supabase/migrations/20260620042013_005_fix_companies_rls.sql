DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;

CREATE POLICY "companies_select" ON companies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "companies_delete" ON companies FOR DELETE TO anon, authenticated USING (true);