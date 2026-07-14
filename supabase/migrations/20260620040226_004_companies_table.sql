CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "companies_delete" ON companies FOR DELETE TO authenticated USING (true);