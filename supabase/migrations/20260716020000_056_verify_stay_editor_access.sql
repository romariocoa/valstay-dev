-- Verify an administrator once when entering the stay editor. The client keeps
-- the password only in component memory and existing mutation RPCs still
-- validate it on every database write.
CREATE OR REPLACE FUNCTION public.verify_stay_editor_access(
  p_session_token uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_role text;
BEGIN
  SELECT s.user_id, s.tenant_id, s.role
  INTO v_user_id, v_tenant_id, v_role
  FROM public.app_sessions s
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND public.tenant_access_allowed(s.tenant_id)
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'sin_permisos';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = v_user_id
      AND u.tenant_id = v_tenant_id
      AND u.password = extensions.crypt(p_password, u.password)
  ) THEN
    RAISE EXCEPTION 'contrasena_incorrecta';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_stay_editor_access(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_stay_editor_access(uuid,text) TO anon, authenticated;
