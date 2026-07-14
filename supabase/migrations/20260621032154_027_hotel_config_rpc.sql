
-- ══════════════════════════════════════════════════════════════
-- 027 · SECURITY DEFINER RPC for hotel_config upsert
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_hotel_config(
  p_session_token  UUID,
  p_name           TEXT,
  p_logo_url       TEXT DEFAULT NULL,
  p_razon_social   TEXT DEFAULT NULL,
  p_ruc            TEXT DEFAULT NULL,
  p_direccion      TEXT DEFAULT NULL,
  p_cuenta_bancaria TEXT DEFAULT NULL,
  p_cci            TEXT DEFAULT NULL,
  p_n_detraccion   TEXT DEFAULT NULL
)
RETURNS SETOF hotel_config
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

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Superusuario no puede editar configuracion de hotel directamente';
  END IF;

  RETURN QUERY
  INSERT INTO hotel_config (tenant_id, name, logo_url, razon_social, ruc, direccion, cuenta_bancaria, cci, n_detraccion, updated_at)
  VALUES (v_tenant_id, p_name, p_logo_url, p_razon_social, p_ruc, p_direccion, p_cuenta_bancaria, p_cci, p_n_detraccion, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET name            = EXCLUDED.name,
        logo_url        = EXCLUDED.logo_url,
        razon_social    = EXCLUDED.razon_social,
        ruc             = EXCLUDED.ruc,
        direccion       = EXCLUDED.direccion,
        cuenta_bancaria = EXCLUDED.cuenta_bancaria,
        cci             = EXCLUDED.cci,
        n_detraccion    = EXCLUDED.n_detraccion,
        updated_at      = now()
  RETURNING *;
END;
$$;
