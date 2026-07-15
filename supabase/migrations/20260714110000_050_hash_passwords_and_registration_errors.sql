-- Hash existing and future custom-auth passwords with bcrypt. Existing users
-- keep the same password; only its stored representation changes.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS validate_app_user_password_trigger ON public.app_users;

UPDATE public.app_users
SET password = extensions.crypt(password, extensions.gen_salt('bf', 12))
WHERE password !~ '^\$2[aby]\$';

CREATE OR REPLACE FUNCTION public.validate_app_user_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Already-hashed values are accepted for migrations/administration only.
  IF NEW.password ~ '^\$2[aby]\$' THEN RETURN NEW; END IF;

  IF length(NEW.password) < 5
     OR NEW.password !~ '[A-Z]'
     OR NEW.password !~ '[a-z]'
     OR NEW.password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;

  -- With no hotel field on login, an identical username/password pair across
  -- tenants would be ambiguous. Reject new ambiguous pairs at write time.
  IF EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE lower(trim(u.username)) = lower(trim(NEW.username))
      AND u.id IS DISTINCT FROM NEW.id
      AND u.password = extensions.crypt(NEW.password, u.password)
  ) THEN
    RAISE EXCEPTION 'usuario_clave_duplicados';
  END IF;

  NEW.password := extensions.crypt(NEW.password, extensions.gen_salt('bf', 12));
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_app_user_password_trigger
BEFORE INSERT OR UPDATE OF password, username ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.validate_app_user_password();

CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS TABLE(session_token uuid, user_id uuid, username text, role text, display_name text, tenant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_user app_users%ROWTYPE; v_token uuid; v_hotel_name text;
BEGIN
  SELECT * INTO STRICT v_user FROM public.app_users
  WHERE lower(trim(app_users.username)) = lower(trim(p_username))
    AND app_users.password = extensions.crypt(p_password, app_users.password);

  IF v_user.tenant_id IS NOT NULL AND NOT public.tenant_access_allowed(v_user.tenant_id) THEN
    SELECT t.name INTO v_hotel_name FROM public.tenants t WHERE t.id = v_user.tenant_id;
    RAISE EXCEPTION 'tenant_bloqueado:%', COALESCE(v_hotel_name, 'sin indicar');
  END IF;

  v_token := gen_random_uuid();
  INSERT INTO public.app_sessions (session_token, user_id, tenant_id, role, expires_at)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role, 'infinity'::timestamptz);
  RETURN QUERY SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
EXCEPTION
  WHEN NO_DATA_FOUND THEN RAISE EXCEPTION 'credenciales_invalidas';
  WHEN TOO_MANY_ROWS THEN RAISE EXCEPTION 'credenciales_ambiguas';
END;
$$;

CREATE OR REPLACE FUNCTION public.register_from_invite(
  p_token uuid, p_hotel_name text, p_display_name text, p_phone text,
  p_username text, p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.registration_invites%ROWTYPE;
  v_tenant uuid;
  v_slug text;
  v_phone text;
BEGIN
  SELECT * INTO v_invite FROM public.registration_invites
  WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invitacion_invalida';
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(trim(p_hotel_name)) < 3 THEN RAISE EXCEPTION 'hotel_invalido'; END IF;
  IF length(trim(p_display_name)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF length(v_phone) <> 9 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF length(trim(p_username)) < 3 THEN RAISE EXCEPTION 'usuario_invalido'; END IF;
  IF length(p_password) < 5 OR p_password !~ '[A-Z]'
     OR p_password !~ '[a-z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;

  v_slug := regexp_replace(lower(trim(p_hotel_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.tenants(name, slug, status, plan_name, trial_ends_at, contact_phone)
  VALUES (trim(p_hotel_name), v_slug, 'trial', 'Prueba gratuita', now() + interval '14 days', v_phone)
  RETURNING id INTO v_tenant;

  INSERT INTO public.app_users(username, password, role, display_name, tenant_id, must_change_password)
  VALUES (lower(trim(p_username)), p_password, 'admin', trim(p_display_name), v_tenant, true);
  UPDATE public.registration_invites SET used_at = now() WHERE token = p_token;
END;
$$;

