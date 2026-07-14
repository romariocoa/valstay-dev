
-- 030 · Save hotel firma RPC (mirrors save_hotel_logo)
CREATE OR REPLACE FUNCTION save_hotel_firma(
  p_session_token UUID,
  p_firma_url     TEXT
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
  SET firma_url  = p_firma_url,
      updated_at = now()
  WHERE tenant_id = v_tenant_id;
END;
$$;
