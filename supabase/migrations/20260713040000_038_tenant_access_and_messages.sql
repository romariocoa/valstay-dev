-- Tenant lifecycle, forced session revocation and tenant-scoped announcements.
DO $$
DECLARE v_first_install boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'status'
  ) INTO v_first_install;

  ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
    ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'Prueba gratuita',
    ADD COLUMN IF NOT EXISTS suspension_reason text;

  -- Existing customers remain active. This only runs the first time the feature is installed.
  IF v_first_install THEN
    UPDATE public.tenants SET status = 'active', plan_name = 'Activo';
  END IF;
END $$;

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('trial', 'active', 'suspended', 'expired'));

CREATE TABLE IF NOT EXISTS public.tenant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'info'
    CHECK (message_type IN ('info', 'warning', 'payment', 'suspension')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  read_at timestamptz
);

ALTER TABLE public.tenant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_messages_select ON public.tenant_messages;
CREATE POLICY tenant_messages_select ON public.tenant_messages FOR SELECT TO anon
  USING (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session());

DROP POLICY IF EXISTS tenant_messages_insert ON public.tenant_messages;
CREATE POLICY tenant_messages_insert ON public.tenant_messages FOR INSERT TO anon
  WITH CHECK (public.is_superuser_session());

DROP POLICY IF EXISTS tenant_messages_update ON public.tenant_messages;
CREATE POLICY tenant_messages_update ON public.tenant_messages FOR UPDATE TO anon
  USING (public.is_superuser_session()) WITH CHECK (public.is_superuser_session());

DROP POLICY IF EXISTS tenant_messages_delete ON public.tenant_messages;
CREATE POLICY tenant_messages_delete ON public.tenant_messages FOR DELETE TO anon
  USING (public.is_superuser_session());

CREATE OR REPLACE FUNCTION public.manage_tenant_access(
  p_session_token uuid,
  p_tenant_id uuid,
  p_status text,
  p_trial_ends_at timestamptz DEFAULT NULL,
  p_plan_name text DEFAULT NULL,
  p_reason text DEFAULT NULL
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
      plan_name = COALESCE(NULLIF(trim(p_plan_name), ''), plan_name),
      suspension_reason = CASE WHEN p_status IN ('suspended', 'expired') THEN p_reason ELSE NULL END
  WHERE id = p_tenant_id;

  IF p_status IN ('suspended', 'expired') THEN
    DELETE FROM public.app_sessions WHERE tenant_id = p_tenant_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_tenant_sessions(
  p_session_token uuid,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM public._resolve_session(p_session_token);
  IF v_role IS DISTINCT FROM 'superuser' THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  DELETE FROM public.app_sessions WHERE tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_tenant_message_read(p_session_token uuid, p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_role text;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role FROM public._resolve_session(p_session_token);
  IF v_role IS NULL OR v_tenant_id IS NULL THEN RAISE EXCEPTION 'Sesion invalida'; END IF;
  UPDATE public.tenant_messages SET read_at = now()
  WHERE id = p_message_id AND tenant_id = v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_access_info(p_session_token uuid)
RETURNS TABLE(status text, trial_ends_at timestamptz, plan_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.status, t.trial_ends_at, t.plan_name
  FROM public._resolve_session(p_session_token) s
  JOIN public.tenants t ON t.id = s.tenant_id
  LIMIT 1;
$$;

-- Login refuses suspended/expired hotels. Superusers have no tenant and remain unaffected.
CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS TABLE(session_token uuid, user_id uuid, username text, role text, display_name text, tenant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user app_users%ROWTYPE; v_token uuid; v_status text; v_trial_ends_at timestamptz;
BEGIN
  SELECT * INTO v_user FROM public.app_users
  WHERE app_users.username = lower(trim(p_username)) AND app_users.password = p_password;
  IF NOT FOUND THEN RAISE EXCEPTION 'credenciales_invalidas'; END IF;

  IF v_user.tenant_id IS NOT NULL THEN
    SELECT t.status, t.trial_ends_at INTO v_status, v_trial_ends_at FROM public.tenants t WHERE t.id = v_user.tenant_id;
    IF v_status IN ('suspended', 'expired') OR (v_status = 'trial' AND v_trial_ends_at < now()) THEN
      RAISE EXCEPTION 'tenant_bloqueado';
    END IF;
  END IF;

  v_token := gen_random_uuid();
  INSERT INTO public.app_sessions (session_token, user_id, tenant_id, role, expires_at)
  VALUES (v_token, v_user.id, v_user.tenant_id, v_user.role, 'infinity'::timestamptz);
  RETURN QUERY SELECT v_token, v_user.id, v_user.username, v_user.role, v_user.display_name, v_user.tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_session(p_session_token uuid)
RETURNS TABLE(user_id uuid, tenant_id uuid, role text, display_name text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, s.tenant_id, s.role, u.display_name, u.username
  FROM public.app_sessions s
  JOIN public.app_users u ON u.id = s.user_id
  LEFT JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.session_token = p_session_token AND s.expires_at > now()
    AND (s.tenant_id IS NULL OR (t.status NOT IN ('suspended', 'expired')
      AND NOT (t.status = 'trial' AND t.trial_ends_at < now())))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.manage_tenant_access(uuid, uuid, text, timestamptz, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_sessions(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_tenant_message_read(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_access_info(uuid) TO anon, authenticated;
