-- Extend the audit trail to include password-confirmed stay deletions.
ALTER TABLE public.stay_edit_audit
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'edit';

ALTER TABLE public.stay_edit_audit
  DROP CONSTRAINT IF EXISTS stay_edit_audit_action_check;
ALTER TABLE public.stay_edit_audit
  ADD CONSTRAINT stay_edit_audit_action_check CHECK (action IN ('edit', 'delete'));

ALTER TABLE public.stay_edit_audit
  ALTER COLUMN new_check_in_date DROP NOT NULL,
  ALTER COLUMN new_check_out_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.delete_stay_confirmed(
  p_session_token uuid,
  p_stay_id uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_role text;
  v_stay public.stays%ROWTYPE;
BEGIN
  SELECT s.user_id, s.tenant_id, s.role
  INTO v_user_id, v_tenant_id, v_role
  FROM public.app_sessions s
  WHERE s.session_token = p_session_token
    AND s.expires_at > now()
    AND public.tenant_access_allowed(s.tenant_id)
  LIMIT 1;

  IF v_user_id IS NULL OR v_tenant_id IS NULL OR v_role <> 'admin' THEN
    RAISE EXCEPTION 'sin_permisos';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.id = v_user_id
      AND u.tenant_id = v_tenant_id
      AND u.password = extensions.crypt(p_password, u.password)
  ) THEN
    RAISE EXCEPTION 'contrasena_incorrecta';
  END IF;

  SELECT * INTO v_stay
  FROM public.stays s
  WHERE s.id = p_stay_id AND s.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'estancia_no_encontrada'; END IF;

  INSERT INTO public.stay_edit_audit (
    tenant_id, stay_id, guest_id, changed_by,
    old_check_in_date, new_check_in_date,
    old_check_out_date, new_check_out_date, stay_status, action
  ) VALUES (
    v_tenant_id, v_stay.id, v_stay.guest_id, v_user_id,
    v_stay.check_in_date, NULL,
    v_stay.check_out_date, NULL, v_stay.status, 'delete'
  );

  DELETE FROM public.stays
  WHERE id = v_stay.id AND tenant_id = v_tenant_id;

  IF v_stay.status IN ('active', 'baja') AND NOT EXISTS (
    SELECT 1 FROM public.stays s
    WHERE s.tenant_id = v_tenant_id
      AND s.room_id = v_stay.room_id
      AND s.status IN ('active', 'baja')
  ) THEN
    UPDATE public.rooms
    SET status = 'available'
    WHERE id = v_stay.room_id AND tenant_id = v_tenant_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_stay_confirmed(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_stay_confirmed(uuid,uuid,text) TO anon, authenticated;
