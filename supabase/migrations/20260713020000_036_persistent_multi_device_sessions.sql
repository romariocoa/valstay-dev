-- Allow the same app user to stay signed in on multiple browsers/devices.
-- Every session remains tenant-scoped and logout_user removes only its token.
CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
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
  v_user  app_users%ROWTYPE;
  v_token UUID;
BEGIN
  SELECT * INTO v_user
  FROM public.app_users
  WHERE app_users.username = lower(trim(p_username))
    AND app_users.password = p_password;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credenciales_invalidas';
  END IF;

  -- Do not delete the user's other sessions. Each device gets its own token.
  v_token := gen_random_uuid();

  INSERT INTO public.app_sessions (
    session_token,
    user_id,
    tenant_id,
    role,
    expires_at
  )
  VALUES (
    v_token,
    v_user.id,
    v_user.tenant_id,
    v_user.role,
    'infinity'::timestamptz
  );

  RETURN QUERY
  SELECT
    v_token,
    v_user.id,
    v_user.username,
    v_user.role,
    v_user.display_name,
    v_user.tenant_id;
END;
$$;

-- Validate without shortening a persistent session back to 24 hours.
CREATE OR REPLACE FUNCTION public.verify_session(p_session_token UUID)
RETURNS TABLE(
  user_id       UUID,
  tenant_id     UUID,
  role          TEXT,
  display_name  TEXT,
  username      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    s.tenant_id,
    s.role,
    u.display_name,
    u.username
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
  LIMIT 1;
$$;

-- Upgrade every currently valid session as well.
UPDATE public.app_sessions
SET expires_at = 'infinity'::timestamptz
WHERE expires_at > now();
