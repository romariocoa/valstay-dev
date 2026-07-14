
-- ══════════════════════════════════════════════════════════════
-- 031 · verify_session RPC
-- Returns user info if the session token is valid; also refreshes
-- the session expiry so active users stay logged in.
-- ══════════════════════════════════════════════════════════════

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
  -- Extend session by 7 days from now (keeps active users logged in)
  UPDATE app_sessions
  SET expires_at = now() + INTERVAL '7 days'
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
