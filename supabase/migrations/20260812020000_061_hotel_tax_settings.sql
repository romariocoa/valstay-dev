-- Non-sensitive electronic billing configuration per hotel.
ALTER TABLE hotel_config
  ADD COLUMN IF NOT EXISTS tax_settings jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "invoice_series": "F001",
    "receipt_series": "B001",
    "igv_rate": 18,
    "prices_include_igv": true,
    "pse_provider": "",
    "environment": "test"
  }'::jsonb;

CREATE OR REPLACE FUNCTION save_hotel_tax_settings(
  p_session_token UUID,
  p_settings JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
  v_invoice_series TEXT := upper(trim(COALESCE(p_settings->>'invoice_series', '')));
  v_receipt_series TEXT := upper(trim(COALESCE(p_settings->>'receipt_series', '')));
  v_igv_rate NUMERIC := COALESCE((p_settings->>'igv_rate')::numeric, 18);
  v_environment TEXT := COALESCE(p_settings->>'environment', 'test');
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role FROM _resolve_session(p_session_token);
  IF v_role IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
  END IF;
  IF v_role NOT IN ('admin', 'superuser') THEN
    RAISE EXCEPTION 'No tienes permisos para configurar facturacion electronica';
  END IF;
  IF v_invoice_series !~ '^F[A-Z0-9]{3}$' OR v_receipt_series !~ '^B[A-Z0-9]{3}$' THEN
    RAISE EXCEPTION 'Las series deben tener formatos como F001 y B001';
  END IF;
  IF v_igv_rate < 0 OR v_igv_rate > 100 THEN
    RAISE EXCEPTION 'La tasa de IGV no es valida';
  END IF;
  IF v_environment NOT IN ('test', 'production') THEN
    RAISE EXCEPTION 'El entorno no es valido';
  END IF;

  UPDATE hotel_config
  SET tax_settings = jsonb_build_object(
    'enabled', COALESCE((p_settings->>'enabled')::boolean, false),
    'invoice_series', v_invoice_series,
    'receipt_series', v_receipt_series,
    'igv_rate', v_igv_rate,
    'prices_include_igv', COALESCE((p_settings->>'prices_include_igv')::boolean, true),
    'pse_provider', trim(COALESCE(p_settings->>'pse_provider', '')),
    'environment', v_environment
  ), updated_at = now()
  WHERE tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION save_hotel_tax_settings(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_hotel_tax_settings(UUID, JSONB) TO anon, authenticated;
