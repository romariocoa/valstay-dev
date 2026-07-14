-- Fix unique constraints to be tenant-scoped
-- rooms: number unique per tenant
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_number_key;
ALTER TABLE rooms ADD CONSTRAINT rooms_tenant_number_key UNIQUE (tenant_id, number);

-- app_users: username unique per tenant (superuser has null tenant_id, keep global for them)
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_username_key;
ALTER TABLE app_users ADD CONSTRAINT app_users_tenant_username_key UNIQUE (tenant_id, username);

-- Make get_session_tenant_id robust against JSON parse errors
CREATE OR REPLACE FUNCTION get_session_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers TEXT;
  v_token   UUID;
BEGIN
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NULL OR v_headers = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_token := (v_headers::jsonb ->> 'x-session-token')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT s.tenant_id FROM app_sessions s
    WHERE s.session_token = v_token
      AND s.expires_at > now()
    LIMIT 1
  );
END;
$$;

-- Same robustness for is_superuser_session
CREATE OR REPLACE FUNCTION is_superuser_session()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers TEXT;
  v_token   UUID;
BEGIN
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NULL OR v_headers = '' THEN
    RETURN false;
  END IF;
  BEGIN
    v_token := (v_headers::jsonb ->> 'x-session-token')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_token IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM app_sessions s
    WHERE s.session_token = v_token
      AND s.role = 'superuser'
      AND s.expires_at > now()
  );
END;
$$;
