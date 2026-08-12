-- Local searchable copy of SUNAT's public reduced RUC directory.
CREATE TABLE IF NOT EXISTS sunat_taxpayers (
  ruc text PRIMARY KEY CHECK (ruc ~ '^\d{11}$'),
  business_name text NOT NULL,
  status text NOT NULL DEFAULT '',
  condition text NOT NULL DEFAULT '',
  ubigeo text NOT NULL DEFAULT '',
  fiscal_address text NOT NULL DEFAULT '',
  source_updated_at date,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sunat_taxpayers_business_name_idx
  ON sunat_taxpayers USING gin (to_tsvector('simple', business_name));

ALTER TABLE sunat_taxpayers ENABLE ROW LEVEL SECURITY;
-- No client policies: lookups are served only by the authenticated Edge Function.

CREATE TABLE IF NOT EXISTS sunat_directory_imports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_url text NOT NULL,
  source_date date,
  imported_rows bigint NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE sunat_directory_imports ENABLE ROW LEVEL SECURITY;
