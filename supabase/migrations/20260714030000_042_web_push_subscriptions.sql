-- Browser push subscriptions and daily delivery deduplication.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_tenant_idx
  ON public.push_subscriptions(tenant_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notice_date date NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, notice_date)
);

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

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
  SELECT user_id, tenant_id, role
  INTO v_user_id, v_tenant_id, v_role
  FROM public._resolve_session(p_session_token);

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
  SELECT user_id, tenant_id
  INTO v_user_id, v_tenant_id
  FROM public._resolve_session(p_session_token);

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida';
  END IF;

  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint
    AND tenant_id = v_tenant_id
    AND user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_subscription(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_subscription(uuid, text) TO anon, authenticated;

