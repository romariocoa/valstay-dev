-- Contact phone captured during invite registration and an explicit end date
-- for paid/active plans.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS plan_ends_at timestamptz;

DROP FUNCTION IF EXISTS public.register_from_invite(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_from_invite(
  p_token uuid,
  p_hotel_name text,
  p_display_name text,
  p_phone text,
  p_username text,
  p_password text
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
  SELECT * INTO v_invite
  FROM public.registration_invites
  WHERE token = p_token
  FOR UPDATE;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

  IF NOT FOUND OR v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invitacion_invalida';
  END IF;
  IF length(trim(p_hotel_name)) < 3 OR length(trim(p_display_name)) < 3
     OR length(v_phone) <> 9 OR length(trim(p_username)) < 3 OR length(p_password) < 6
     OR p_password !~ '[A-Z]' OR p_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'datos_invalidos';
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

GRANT EXECUTE ON FUNCTION public.register_from_invite(uuid, text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.manage_tenant_access(
  p_session_token uuid,
  p_tenant_id uuid,
  p_status text,
  p_trial_ends_at timestamptz DEFAULT NULL,
  p_plan_name text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_plan_ends_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public._resolve_session(p_session_token);
  IF v_role IS DISTINCT FROM 'superuser' THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;
  IF p_status NOT IN ('trial', 'active', 'suspended', 'expired') THEN
    RAISE EXCEPTION 'Estado invalido';
  END IF;

  UPDATE public.tenants
  SET status = p_status,
      trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
      plan_ends_at = p_plan_ends_at,
      plan_name = COALESCE(NULLIF(trim(p_plan_name), ''), plan_name),
      suspension_reason = CASE WHEN p_status IN ('suspended', 'expired') THEN p_reason ELSE NULL END
  WHERE id = p_tenant_id;

  IF p_status IN ('suspended', 'expired') THEN
    DELETE FROM public.app_sessions WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_tenant_access(uuid, uuid, text, timestamptz, text, text, timestamptz) TO anon, authenticated;
