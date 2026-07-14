
-- ══════════════════════════════════════════════════════════════
-- 021 · Multi-tenant architecture
-- ══════════════════════════════════════════════════════════════

-- 1. tenants table
CREATE TABLE tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_select" ON tenants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tenants_insert" ON tenants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tenants_update" ON tenants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tenants_delete" ON tenants FOR DELETE TO anon, authenticated USING (true);

-- 2. app_users: update role constraint to include superuser
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('superuser', 'admin', 'receptionist'));

-- 3. Add tenant_id columns (nullable for now)
ALTER TABLE rooms               ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE guests              ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE stays               ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE companies           ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE hotel_config        ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE floor_plan_elements ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE floor_plan_config   ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE app_users           ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Create default tenant and migrate existing data
DO $$
DECLARE
  dtid UUID;
BEGIN
  INSERT INTO tenants (name, slug) VALUES ('Hotel Principal', 'hotel-principal') RETURNING id INTO dtid;

  UPDATE rooms               SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE guests              SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE stays               SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE companies           SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE hotel_config        SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE floor_plan_elements SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE floor_plan_config   SET tenant_id = dtid WHERE tenant_id IS NULL;
  UPDATE app_users           SET tenant_id = dtid WHERE tenant_id IS NULL;
END $$;

-- 5. floor_plan_config: rebuild PK as composite (tenant_id, floor)
ALTER TABLE floor_plan_config DROP CONSTRAINT floor_plan_config_pkey;
ALTER TABLE floor_plan_config ADD PRIMARY KEY (tenant_id, floor);

-- 6. floor_plan_elements: drop old unique, add per-tenant unique
ALTER TABLE floor_plan_elements DROP CONSTRAINT IF EXISTS fpe_unique;
CREATE UNIQUE INDEX fpe_tenant_unique ON floor_plan_elements (tenant_id, floor, pos_x, pos_y);

-- 7. hotel_config: unique per tenant
CREATE UNIQUE INDEX hotel_config_tenant_unique ON hotel_config (tenant_id);

-- 8. guests DNI unique per tenant
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_dni_key;
CREATE UNIQUE INDEX guests_dni_tenant ON guests (tenant_id, dni);

-- 9. Create superuser (no tenant)
INSERT INTO app_users (username, password, role, display_name, tenant_id)
VALUES ('superadmin', 'super123', 'superuser', 'Super Administrador', NULL)
ON CONFLICT (username) DO NOTHING;
