-- Production hardening: consistent credentials, fail-closed login,
-- tenant-safe stay relationships, and access expiry enforced in the database.

CREATE OR REPLACE FUNCTION public.validate_app_user_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(NEW.password) < 5
     OR NEW.password !~ '[A-Z]'
     OR NEW.password !~ '[a-z]'
     OR NEW.password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_app_user_password_trigger ON public.app_users;
CREATE TRIGGER validate_app_user_password_trigger
BEFORE INSERT OR UPDATE OF password ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.validate_app_user_password();

CREATE OR REPLACE FUNCTION public.change_initial_password(p_session_token uuid, p_new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF length(p_new_password) < 5 OR p_new_password !~ '[A-Z]'
     OR p_new_password !~ '[a-z]' OR p_new_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;
  SELECT s.user_id INTO v_user_id FROM public.app_sessions s
  WHERE s.session_token = p_session_token AND s.expires_at > now() LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'sesion_invalida'; END IF;
  UPDATE public.app_users
  SET password = p_new_password, must_change_password = false
  WHERE id = v_user_id;
END;
$$;

-- Existing records must already be consistent before enabling the guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stays s
    JOIN public.guests g ON g.id = s.guest_id
    JOIN public.rooms r ON r.id = s.room_id
    WHERE g.tenant_id IS DISTINCT FROM s.tenant_id
       OR r.tenant_id IS DISTINCT FROM s.tenant_id
  ) THEN
    RAISE EXCEPTION 'Existen estadias relacionadas con huespedes o habitaciones de otro tenant';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_stay_tenant_relations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE id = NEW.guest_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'huesped_tenant_invalido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = NEW.room_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'habitacion_tenant_invalido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_stay_tenant_relations_trigger ON public.stays;
CREATE TRIGGER validate_stay_tenant_relations_trigger
BEFORE INSERT OR UPDATE OF tenant_id, guest_id, room_id ON public.stays
FOR EACH ROW EXECUTE FUNCTION public.validate_stay_tenant_relations();

CREATE OR REPLACE FUNCTION public.tenant_access_allowed(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id
      AND (
        (t.status = 'trial' AND t.trial_ends_at >= now())
        OR (t.status = 'active' AND (t.plan_ends_at IS NULL OR t.plan_ends_at >= now()))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_session_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_headers text; v_token uuid; v_tenant_id uuid;
BEGIN
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NULL OR v_headers = '' THEN RETURN NULL; END IF;
  BEGIN
    v_token := (v_headers::jsonb ->> 'x-session-token')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  SELECT s.tenant_id INTO v_tenant_id
  FROM public.app_sessions s
  WHERE s.session_token = v_token AND s.expires_at > now()
  LIMIT 1;
  IF v_tenant_id IS NULL OR NOT public.tenant_access_allowed(v_tenant_id) THEN
    RETURN NULL;
  END IF;
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._resolve_session(p_token uuid)
RETURNS TABLE(tenant_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.tenant_id, s.role
  FROM public.app_sessions s
  WHERE s.session_token = p_token
    AND s.expires_at > now()
    AND (
      (s.role = 'superuser' AND s.tenant_id IS NULL)
      OR public.tenant_access_allowed(s.tenant_id)
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS TABLE(session_token uuid, user_id uuid, username text, role text, display_name text, tenant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user app_users%ROWTYPE; v_token uuid; v_hotel_name text;
BEGIN
  SELECT * INTO STRICT v_user FROM public.app_users
  WHERE lower(app_users.username) = lower(trim(p_username))
    AND app_users.password = p_password;

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

CREATE OR REPLACE FUNCTION public.verify_session(p_session_token uuid)
RETURNS TABLE(user_id uuid, tenant_id uuid, role text, display_name text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, s.tenant_id, s.role, u.display_name, u.username
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND (
      (s.role = 'superuser' AND s.tenant_id IS NULL)
      OR public.tenant_access_allowed(s.tenant_id)
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_session_token uuid, p_endpoint text, p_p256dh text, p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_tenant_id uuid; v_role text;
BEGIN
  SELECT s.user_id, s.tenant_id, s.role
  INTO v_user_id, v_tenant_id, v_role
  FROM public.app_sessions s
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND public.tenant_access_allowed(s.tenant_id)
  LIMIT 1;
  IF v_user_id IS NULL OR v_tenant_id IS NULL OR v_role NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Sesion invalida o sin permisos';
  END IF;
  INSERT INTO public.push_subscriptions
    (tenant_id, user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES
    (v_tenant_id, v_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
  ON CONFLICT (endpoint) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_access_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_access_allowed(uuid) TO anon, authenticated;
