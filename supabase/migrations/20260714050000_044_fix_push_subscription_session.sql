-- Fix push registration RPCs already deployed by migration 042.
-- _resolve_session returns tenant_id and role only, so user_id must be read
-- directly from the validated app session.
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_session_token uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL OR v_role NOT IN ('admin', 'receptionist') THEN
    RAISE EXCEPTION 'Sesion invalida o sin permisos';
  END IF;

  INSERT INTO public.push_subscriptions (
    tenant_id, user_id, endpoint, p256dh, auth, user_agent, updated_at
  )
  VALUES (
    v_tenant_id, v_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now()
  )
  ON CONFLICT (endpoint) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(
  p_session_token uuid,
  p_endpoint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT s.user_id, s.tenant_id
  INTO v_user_id, v_tenant_id
  FROM public.app_sessions s
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida';
  END IF;

  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint
    AND tenant_id = v_tenant_id
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unregister_push_subscription(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(uuid, text) TO anon, authenticated;
