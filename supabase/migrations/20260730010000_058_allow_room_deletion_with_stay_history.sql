-- Rooms use ON DELETE SET NULL in stays so historical stays survive when a
-- room is removed. Tenant validation must therefore accept a null room_id.
CREATE OR REPLACE FUNCTION public.validate_stay_tenant_relations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.guests
    WHERE id = NEW.guest_id
      AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'huesped_tenant_invalido';
  END IF;

  IF NEW.room_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.rooms
       WHERE id = NEW.room_id
         AND tenant_id = NEW.tenant_id
     ) THEN
    RAISE EXCEPTION 'habitacion_tenant_invalido';
  END IF;

  RETURN NEW;
END;
$$;
