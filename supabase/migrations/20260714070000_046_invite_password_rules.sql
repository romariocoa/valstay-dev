-- Accept secure invite passwords such as Real.192837465: at least five
-- characters with uppercase, lowercase and a number; symbols are allowed.
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
     OR length(v_phone) <> 9 OR length(trim(p_username)) < 3 OR length(p_password) < 5
     OR p_password !~ '[A-Z]' OR p_password !~ '[a-z]' OR p_password !~ '[0-9]' THEN
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
