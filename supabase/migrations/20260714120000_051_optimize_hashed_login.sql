-- Compare bcrypt only for rows matching the submitted username. This avoids a
-- costly crypt() call across unrelated users and keeps login below API timeout.
CREATE OR REPLACE FUNCTION public.validate_app_user_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.password ~ '^\$2[aby]\$' THEN RETURN NEW; END IF;
  IF length(NEW.password) < 5 OR NEW.password !~ '[A-Z]'
     OR NEW.password !~ '[a-z]' OR NEW.password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE lower(trim(u.username)) = lower(trim(NEW.username))
      AND u.id IS DISTINCT FROM NEW.id
      AND u.password = extensions.crypt(NEW.password, u.password)
  ) THEN
    RAISE EXCEPTION 'usuario_clave_duplicados';
  END IF;
  NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf', 10));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS TABLE(session_token uuid, user_id uuid, username text, role text, display_name text, tenant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_candidate app_users%ROWTYPE;
  v_user app_users%ROWTYPE;
  v_matches integer := 0;
  v_token uuid;
  v_hotel_name text;
BEGIN
  FOR v_candidate IN
    SELECT * FROM public.app_users
    WHERE lower(trim(app_users.username)) = lower(trim(p_username))
  LOOP
    IF v_candidate.password = extensions.crypt(p_password, v_candidate.password) THEN
      v_matches := v_matches + 1;
      v_user := v_candidate;
    END IF;
  END LOOP;

  IF v_matches = 0 THEN RAISE EXCEPTION 'credenciales_invalidas'; END IF;
  IF v_matches > 1 THEN RAISE EXCEPTION 'credenciales_ambiguas'; END IF;

  IF v_user.tenant_id IS NOT NULL AND NOT public.tenant_access_allowed(v_user.tenant_id) THEN
    SELECT t.name INTO v_hotel_name FROM public.tenants t WHERE t.id = v_user.tenant_id;
    RAISE EXCEPTION 'tenant_bloqueado:%', COALESCE(v_hotel_name, 'sin indicar');
  END IF;

  v_token := gen_random_uuid();
  INSERT INTO public.app_sessions (session_token, user_id, tenant_id, role, expires_at)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role, 'infinity'::timestamptz);
  RETURN QUERY SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
END;
$$;

