-- Payment method and transfer evidence for particular stays.
ALTER TABLE stays
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_receipt_url text;

ALTER TABLE stays DROP CONSTRAINT IF EXISTS stays_payment_method_check;
ALTER TABLE stays
  ADD CONSTRAINT stays_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('efectivo', 'tarjeta', 'yape', 'plin'));

ALTER TABLE hotel_config
  ADD COLUMN IF NOT EXISTS yape_qr_url text,
  ADD COLUMN IF NOT EXISTS plin_qr_url text;

CREATE OR REPLACE FUNCTION save_hotel_payment_qrs(
  p_session_token UUID,
  p_yape_qr_url   TEXT,
  p_plin_qr_url   TEXT
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
  SET yape_qr_url = p_yape_qr_url,
      plin_qr_url = p_plin_qr_url,
      updated_at  = now()
  WHERE tenant_id = v_tenant_id;
END;
$$;
