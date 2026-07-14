
-- ══════════════════════════════════════════════════════════════
-- 028 · Split hotel_config RPCs: fields vs logo
-- ══════════════════════════════════════════════════════════════

-- 1. Fields-only update (no logo in payload)
CREATE OR REPLACE FUNCTION save_hotel_fields(
  p_session_token   UUID,
  p_name            TEXT,
  p_razon_social    TEXT DEFAULT NULL,
  p_ruc             TEXT DEFAULT NULL,
  p_direccion       TEXT DEFAULT NULL,
  p_cuenta_bancaria TEXT DEFAULT NULL,
  p_cci             TEXT DEFAULT NULL,
  p_n_detraccion    TEXT DEFAULT NULL
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
  IF v_role IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;

  INSERT INTO hotel_config (tenant_id, name, razon_social, ruc, direccion, cuenta_bancaria, cci, n_detraccion, updated_at)
  VALUES (v_tenant_id, p_name, p_razon_social, p_ruc, p_direccion, p_cuenta_bancaria, p_cci, p_n_detraccion, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET name            = EXCLUDED.name,
        razon_social    = EXCLUDED.razon_social,
        ruc             = EXCLUDED.ruc,
        direccion       = EXCLUDED.direccion,
        cuenta_bancaria = EXCLUDED.cuenta_bancaria,
        cci             = EXCLUDED.cci,
        n_detraccion    = EXCLUDED.n_detraccion,
        updated_at      = now();
END;
$$;

-- 2. Logo-only update
CREATE OR REPLACE FUNCTION save_hotel_logo(
  p_session_token UUID,
  p_logo_url      TEXT
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
  IF v_role IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;

  UPDATE hotel_config
  SET logo_url   = p_logo_url,
      updated_at = now()
  WHERE tenant_id = v_tenant_id;
END;
$$;
