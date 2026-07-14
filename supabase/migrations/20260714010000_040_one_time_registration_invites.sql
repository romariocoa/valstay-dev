CREATE TABLE IF NOT EXISTS public.registration_invites (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz
);

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_registration_invite(p_session_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_role text; v_token uuid;
BEGIN
  SELECT s.user_id, s.role
  INTO v_user_id, v_role
  FROM public.app_sessions s
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
  LIMIT 1;
  IF v_role IS DISTINCT FROM 'superuser' THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  INSERT INTO public.registration_invites(created_by) VALUES (v_user_id) RETURNING token INTO v_token;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_from_invite(
  p_token uuid, p_hotel_name text, p_display_name text, p_username text, p_password text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.registration_invites%ROWTYPE; v_tenant uuid; v_slug text;
BEGIN
  SELECT * INTO v_invite FROM public.registration_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invitacion_invalida';
  END IF;
  IF length(trim(p_hotel_name)) < 3 OR length(trim(p_display_name)) < 3
     OR length(trim(p_username)) < 3 OR length(p_password) < 6
     OR p_password !~ '[A-Z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'datos_invalidos';
  END IF;

  v_slug := regexp_replace(lower(trim(p_hotel_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO public.tenants(name, slug, status, plan_name, trial_ends_at)
  VALUES (trim(p_hotel_name), v_slug, 'trial', 'Prueba gratuita', now() + interval '14 days')
  RETURNING id INTO v_tenant;

  INSERT INTO public.app_users(username, password, role, display_name, tenant_id, must_change_password)
  VALUES (lower(trim(p_username)), p_password, 'admin', trim(p_display_name), v_tenant, true);
  UPDATE public.registration_invites SET used_at = now() WHERE token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.needs_password_change(p_session_token uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT u.must_change_password FROM public.app_sessions s
    JOIN public.app_users u ON u.id = s.user_id
    WHERE s.session_token = p_session_token AND s.expires_at > now() LIMIT 1), false);
$$;

CREATE OR REPLACE FUNCTION public.change_initial_password(p_session_token uuid, p_new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF length(p_new_password) < 6 OR p_new_password !~ '[A-Z]' OR p_new_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'password_invalida';
  END IF;
  SELECT s.user_id INTO v_user_id FROM public.app_sessions s
  WHERE s.session_token = p_session_token AND s.expires_at > now() LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'sesion_invalida'; END IF;
  UPDATE public.app_users SET password = p_new_password, must_change_password = false WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_registration_invite(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_from_invite(uuid,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.needs_password_change(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_initial_password(uuid,text) TO anon, authenticated;
REVOKE ALL ON public.registration_invites FROM anon, authenticated;
