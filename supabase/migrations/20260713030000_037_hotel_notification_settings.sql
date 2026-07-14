-- Tenant-specific browser notification schedule.
ALTER TABLE public.hotel_config
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_time time NOT NULL DEFAULT '07:00';

CREATE OR REPLACE FUNCTION public.save_hotel_notification_settings(
  p_session_token UUID,
  p_enabled boolean,
  p_notification_time time
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, role
  INTO v_tenant_id, v_role
  FROM public._resolve_session(p_session_token);

  IF v_role IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sesion invalida o expirada';
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
