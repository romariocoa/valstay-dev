-- Password-confirmed stay date corrections with tenant-safe auditing.
CREATE TABLE IF NOT EXISTS public.stay_edit_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stay_id uuid NOT NULL REFERENCES public.stays(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  old_check_in_date date NOT NULL,
  new_check_in_date date NOT NULL,
  old_check_out_date date NOT NULL,
  new_check_out_date date NOT NULL,
  stay_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_edit_audit_tenant_stay_idx
  ON public.stay_edit_audit (tenant_id, stay_id, changed_at DESC);

ALTER TABLE public.stay_edit_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stay_edit_audit FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.edit_stay_dates(
  p_session_token uuid,
  p_stay_id uuid,
  p_check_in_date date,
  p_check_out_date date,
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
  v_new_check_out date;
  v_today date := (now() AT TIME ZONE 'America/Lima')::date;
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
  IF p_check_in_date IS NULL OR p_check_in_date > v_today THEN
    RAISE EXCEPTION 'fecha_ingreso_invalida';
  END IF;

  IF v_stay.status IN ('active', 'baja') THEN
    v_new_check_out := v_stay.check_out_date;
  ELSE
    v_new_check_out := p_check_out_date;
    IF v_new_check_out IS NULL OR v_new_check_out >= v_today
       OR p_check_in_date > v_new_check_out THEN
      RAISE EXCEPTION 'fecha_salida_invalida';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stays other
    WHERE other.tenant_id = v_tenant_id
      AND other.id <> v_stay.id
      AND other.guest_id = v_stay.guest_id
      AND daterange(other.check_in_date, other.check_out_date, '[]')
          && daterange(p_check_in_date, v_new_check_out, '[]')
  ) THEN
    RAISE EXCEPTION 'estancia_huesped_superpuesta';
  END IF;

  IF p_check_in_date = v_stay.check_in_date
     AND v_new_check_out = v_stay.check_out_date THEN
    RAISE EXCEPTION 'sin_cambios';
  END IF;

  UPDATE public.stays
  SET check_in_date = p_check_in_date,
      check_out_date = v_new_check_out
  WHERE id = v_stay.id AND tenant_id = v_tenant_id;

  INSERT INTO public.stay_edit_audit (
    tenant_id, stay_id, guest_id, changed_by,
    old_check_in_date, new_check_in_date,
    old_check_out_date, new_check_out_date, stay_status
  ) VALUES (
    v_tenant_id, v_stay.id, v_stay.guest_id, v_user_id,
    v_stay.check_in_date, p_check_in_date,
    v_stay.check_out_date, v_new_check_out, v_stay.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edit_stay_dates(uuid,uuid,date,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_stay_dates(uuid,uuid,date,date,text) TO anon, authenticated;
