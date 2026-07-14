CREATE TABLE IF NOT EXISTS hotel_config (
  id         integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       text NOT NULL DEFAULT 'Hotel Manager',
  logo_url   text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE hotel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_config_select" ON hotel_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hotel_config_update" ON hotel_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hotel_config_insert" ON hotel_config FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Seed single config row
INSERT INTO hotel_config (id, name) VALUES (1, 'Hotel Manager')
ON CONFLICT (id) DO NOTHING;
