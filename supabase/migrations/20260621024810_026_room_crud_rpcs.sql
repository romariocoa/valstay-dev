
-- ══════════════════════════════════════════════════════════════
-- 026 · SECURITY DEFINER RPCs for room CRUD
-- Bypasses request.headers dependency; session token passed explicitly.
-- ══════════════════════════════════════════════════════════════

-- Helper: resolve tenant_id + role from session token (internal use)
CREATE OR REPLACE FUNCTION _resolve_session(p_token UUID)
RETURNS TABLE(tenant_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT s.tenant_id, s.role
  FROM app_sessions s
  WHERE s.session_token = p_token
    AND s.expires_at > now()
  LIMIT 1;
$$;

-- ── create_room ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_room(
  p_session_token   UUID,
  p_number          TEXT,
  p_floor           INT,
  p_type            TEXT,
  p_capacity        INT,
  p_price_per_night NUMERIC,
  p_status          TEXT DEFAULT 'available'
)
RETURNS SETOF rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role      TEXT;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role FROM _resolve_session(p_session_token);

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;

  -- Superuser must provide a tenant_id — not allowed to create rooms without one.
  IF v_role = 'superuser' THEN
    RAISE EXCEPTION 'Superusuario no puede crear habitaciones directamente';
  END IF;

  RETURN QUERY
  INSERT INTO rooms (number, floor, type, capacity, price_per_night, status, tenant_id)
  VALUES (p_number, p_floor, p_type, p_capacity, p_price_per_night, p_status, v_tenant_id)
  RETURNING *;
END;
$$;

-- ── update_room ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_room(
  p_session_token   UUID,
  p_room_id         UUID,
  p_number          TEXT,
  p_floor           INT,
  p_type            TEXT,
  p_capacity        INT,
  p_price_per_night NUMERIC,
  p_status          TEXT
)
RETURNS SETOF rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role      TEXT;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role FROM _resolve_session(p_session_token);

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;

  RETURN QUERY
  UPDATE rooms
  SET number          = p_number,
      floor           = p_floor,
      type            = p_type,
      capacity        = p_capacity,
      price_per_night = p_price_per_night,
      status          = p_status
  WHERE id = p_room_id
    AND (tenant_id = v_tenant_id OR v_role = 'superuser')
  RETURNING *;
END;
$$;

-- ── delete_room ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_room(
  p_session_token UUID,
  p_room_id       UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role      TEXT;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role FROM _resolve_session(p_session_token);

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;

  DELETE FROM rooms
  WHERE id = p_room_id
    AND (tenant_id = v_tenant_id OR v_role = 'superuser');
END;
$$;
