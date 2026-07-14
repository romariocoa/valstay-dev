-- ═══════════════════════════════════════════════════════════════════════════
-- 022 – Secure RLS: tenant isolation + session-based context
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Fix update_updated_at_column (mutable search_path warning) ────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. app_sessions table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);
CREATE UNIQUE INDEX IF NOT EXISTS app_sessions_token_idx ON app_sessions(session_token);
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
-- No direct client access; only accessed through SECURITY DEFINER functions below.

-- ── 3. Login function (SECURITY DEFINER, bypasses RLS to read app_users) ─────
CREATE OR REPLACE FUNCTION login_user(p_username text, p_password text)
RETURNS TABLE(
  session_token UUID,
  user_id       UUID,
  username      TEXT,
  role          TEXT,
  display_name  TEXT,
  tenant_id     UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user app_users%ROWTYPE;
  v_token UUID;
BEGIN
  SELECT * INTO v_user
  FROM app_users
  WHERE app_users.username = lower(trim(p_username))
    AND app_users.password = p_password;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credenciales_invalidas';
  END IF;

  -- Clean up old sessions for this user
  DELETE FROM app_sessions WHERE app_sessions.user_id = v_user.id;

  v_token := gen_random_uuid();

  INSERT INTO app_sessions (session_token, user_id, tenant_id, role)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role);

  RETURN QUERY
  SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
END;
$$;

-- ── 4. Logout function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION logout_user(p_session_token UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM app_sessions WHERE session_token = p_session_token;
END;
$$;

-- ── 5. RLS helper functions ───────────────────────────────────────────────────

-- Returns the tenant_id for the current session token (from request header).
CREATE OR REPLACE FUNCTION get_session_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.tenant_id
  FROM app_sessions s
  WHERE s.session_token = (
    (current_setting('request.headers', true)::jsonb ->> 'x-session-token')::uuid
  )
    AND s.expires_at > now()
  LIMIT 1;
$$;

-- Returns true when the current session belongs to a superuser.
CREATE OR REPLACE FUNCTION is_superuser_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_sessions s
    WHERE s.session_token = (
      (current_setting('request.headers', true)::jsonb ->> 'x-session-token')::uuid
    )
      AND s.role = 'superuser'
      AND s.expires_at > now()
  );
$$;

-- Returns true when the current session belongs to an admin of its tenant.
CREATE OR REPLACE FUNCTION is_admin_session()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_sessions s
    WHERE s.session_token = (
      (current_setting('request.headers', true)::jsonb ->> 'x-session-token')::uuid
    )
      AND s.role IN ('admin', 'superuser')
      AND s.expires_at > now()
  );
$$;

-- ── 6. Drop ALL existing policies ────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- ── 7. TENANTS — superadmin only ─────────────────────────────────────────────
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  TO anon USING (is_superuser_session());

CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  TO anon WITH CHECK (is_superuser_session());

CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  TO anon USING (is_superuser_session()) WITH CHECK (is_superuser_session());

CREATE POLICY "tenants_delete" ON tenants FOR DELETE
  TO anon USING (is_superuser_session());

-- ── 8. APP_USERS — tenant-scoped + superadmin ────────────────────────────────
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  TO anon USING (
    tenant_id = get_session_tenant_id()
    OR is_superuser_session()
  );

CREATE POLICY "app_users_insert" ON app_users FOR INSERT
  TO anon WITH CHECK (
    tenant_id = get_session_tenant_id()
    OR is_superuser_session()
  );

CREATE POLICY "app_users_update" ON app_users FOR UPDATE
  TO anon
  USING (
    tenant_id = get_session_tenant_id()
    OR is_superuser_session()
  )
  WITH CHECK (
    tenant_id = get_session_tenant_id()
    OR is_superuser_session()
  );

CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  TO anon USING (
    tenant_id = get_session_tenant_id()
    OR is_superuser_session()
  );

-- ── 9. ROOMS ─────────────────────────────────────────────────────────────────
CREATE POLICY "rooms_select" ON rooms FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "rooms_insert" ON rooms FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 10. GUESTS ───────────────────────────────────────────────────────────────
CREATE POLICY "guests_select" ON guests FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "guests_insert" ON guests FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "guests_update" ON guests FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "guests_delete" ON guests FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 11. STAYS ────────────────────────────────────────────────────────────────
CREATE POLICY "stays_select" ON stays FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "stays_insert" ON stays FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "stays_update" ON stays FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "stays_delete" ON stays FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 12. HOTEL_CONFIG ─────────────────────────────────────────────────────────
CREATE POLICY "hotel_config_select" ON hotel_config FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "hotel_config_insert" ON hotel_config FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "hotel_config_update" ON hotel_config FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "hotel_config_delete" ON hotel_config FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 13. COMPANIES ────────────────────────────────────────────────────────────
CREATE POLICY "companies_select" ON companies FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "companies_insert" ON companies FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "companies_update" ON companies FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "companies_delete" ON companies FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 14. FLOOR_PLAN_CONFIG ────────────────────────────────────────────────────
CREATE POLICY "fpc_select" ON floor_plan_config FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpc_insert" ON floor_plan_config FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpc_update" ON floor_plan_config FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpc_delete" ON floor_plan_config FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

-- ── 15. FLOOR_PLAN_ELEMENTS ──────────────────────────────────────────────────
CREATE POLICY "fpe_select" ON floor_plan_elements FOR SELECT
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpe_insert" ON floor_plan_elements FOR INSERT
  TO anon WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpe_update" ON floor_plan_elements FOR UPDATE
  TO anon
  USING (tenant_id = get_session_tenant_id() OR is_superuser_session())
  WITH CHECK (tenant_id = get_session_tenant_id() OR is_superuser_session());

CREATE POLICY "fpe_delete" ON floor_plan_elements FOR DELETE
  TO anon USING (tenant_id = get_session_tenant_id() OR is_superuser_session());
