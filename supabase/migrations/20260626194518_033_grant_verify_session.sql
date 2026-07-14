
-- ══════════════════════════════════════════════════════════════
-- 033 · Grant execute permissions on session RPCs
-- The anon key must be able to call these functions so the
-- client can validate/refresh sessions without a Supabase Auth
-- JWT. Without this grant the RPC returns a permission error
-- which was incorrectly treated as "session expired".
-- ══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION verify_session(UUID)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION login_user(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION logout_user(UUID)      TO anon, authenticated;
