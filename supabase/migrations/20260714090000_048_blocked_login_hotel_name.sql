-- Return the hotel name only after the submitted credentials are validated so
-- the support message can identify the blocked tenant without exposing it by username.
CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS TABLE(session_token uuid, user_id uuid, username text, role text, display_name text, tenant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user app_users%ROWTYPE;
  v_token uuid;
  v_status text;
  v_trial_ends_at timestamptz;
  v_hotel_name text;
BEGIN
  SELECT * INTO v_user FROM public.app_users
  WHERE app_users.username = lower(trim(p_username)) AND app_users.password = p_password;
  IF NOT FOUND THEN RAISE EXCEPTION 'credenciales_invalidas'; END IF;

  IF v_user.tenant_id IS NOT NULL THEN
    SELECT t.status, t.trial_ends_at, t.name
    INTO v_status, v_trial_ends_at, v_hotel_name
    FROM public.tenants t
    WHERE t.id = v_user.tenant_id;

    IF v_status IN ('suspended', 'expired') OR (v_status = 'trial' AND v_trial_ends_at < now()) THEN
      RAISE EXCEPTION 'tenant_bloqueado:%', COALESCE(v_hotel_name, 'sin indicar');
    END IF;
  END IF;

  v_token := gen_random_uuid();
  INSERT INTO public.app_sessions (session_token, user_id, tenant_id, role, expires_at)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role, 'infinity'::timestamptz);
  RETURN QUERY SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
END;
$$;

