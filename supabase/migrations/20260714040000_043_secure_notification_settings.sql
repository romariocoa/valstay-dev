-- Restrict notification scheduling to tenant administrators even when the
-- original notification-settings migration has already been deployed.
CREATE OR REPLACE FUNCTION public.save_hotel_notification_settings(
  p_session_token uuid,
  p_enabled boolean,
  p_notification_time time
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_role text;
BEGIN
  SELECT tenant_id, role
  INTO v_tenant_id, v_role
  FROM public._resolve_session(p_session_token);

  IF v_role IS NULL OR v_tenant_id IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'Sesion invalida o sin permisos de administrador';
  END IF;

  INSERT INTO public.hotel_config (
    tenant_id,
    name,
    notifications_enabled,
    notification_time,
    updated_at
  )
  VALUES (
    v_tenant_id,
    'Hotel Manager',
    COALESCE(p_enabled, false),
    COALESCE(p_notification_time, '07:00'::time),
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET notifications_enabled = EXCLUDED.notifications_enabled,
      notification_time = EXCLUDED.notification_time,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_hotel_notification_settings(uuid, boolean, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_hotel_notification_settings(uuid, boolean, time) TO anon, authenticated;
