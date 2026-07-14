
-- ══════════════════════════════════════════════════════════════
-- 032 · Session lifetime: 24 hours of inactivity
-- Updates login_user and verify_session to use 24h windows.
-- As long as the user opens the app at least once per day,
-- the session is automatically extended and never expires.
-- ══════════════════════════════════════════════════════════════

-- Update login_user: new sessions expire in 24h
CREATE OR REPLACE FUNCTION login_user(p_username text, p_password text)
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
  FROM app_users
  WHERE app_users.username = lower(trim(p_username))
    AND app_users.password  = p_password;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credenciales_invalidas';
  END IF;

  DELETE FROM app_sessions WHERE app_sessions.user_id = v_user.id;

  v_token := gen_random_uuid();
  INSERT INTO app_sessions (session_token, user_id, tenant_id, role, expires_at)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role, now() + INTERVAL '24 hours');

  RETURN QUERY
  SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
END;
$$;

-- Update verify_session: reset expiry to 24h from now (inactivity timer)
CREATE OR REPLACE FUNCTION verify_session(p_session_token UUID)
RETURNS TABLE(
  user_id       UUID,
  tenant_id     UUID,
  role          TEXT,
  display_name  TEXT,
  username      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset expiry: 24h from now (user is active)
  UPDATE app_sessions
  SET expires_at = now() + INTERVAL '24 hours'
  WHERE session_token = p_session_token
    AND expires_at > now();

  RETURN QUERY
  SELECT s.user_id, s.tenant_id, s.role, u.display_name, u.username
  FROM app_sessions s
  JOIN app_users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
  LIMIT 1;
END;
$$;
