CREATE TABLE IF NOT EXISTS app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin', 'receptionist')),
  display_name text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Allow anon full access (custom auth, not Supabase Auth)
CREATE POLICY "app_users_select" ON app_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "app_users_insert" ON app_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "app_users_update" ON app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "app_users_delete" ON app_users FOR DELETE TO anon, authenticated USING (true);

-- Seed default users
INSERT INTO app_users (username, password, role, display_name) VALUES
  ('admin',    'admin123',  'admin',        'Administrador'),
  ('recepcion','recep123',  'receptionist', 'Recepcionista')
ON CONFLICT (username) DO NOTHING;
