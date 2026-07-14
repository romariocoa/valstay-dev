ALTER TABLE hotel_config
  ADD COLUMN IF NOT EXISTS razon_social text,
  ADD COLUMN IF NOT EXISTS ruc text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria text,
  ADD COLUMN IF NOT EXISTS cci text,
  ADD COLUMN IF NOT EXISTS n_detraccion text;
