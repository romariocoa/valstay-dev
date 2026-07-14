-- Public demonstration tenant with realistic sample data and database-enforced read-only access.
DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO v_definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'app_users'
    AND c.conname = 'app_users_role_check';

  IF v_definition IS NULL OR position('demo' IN lower(v_definition)) = 0 THEN
    ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
    ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check
      CHECK (role IN ('superuser', 'admin', 'receptionist', 'demo'));
  END IF;
END $$;

ALTER TABLE public.stays ADD COLUMN IF NOT EXISTS worker_type text;
ALTER TABLE public.stays DROP CONSTRAINT IF EXISTS stays_worker_type_check;
ALTER TABLE public.stays ADD CONSTRAINT stays_worker_type_check
  CHECK (worker_type IS NULL OR worker_type IN ('obrero', 'empleado', 'staff'));

CREATE OR REPLACE FUNCTION public.is_demo_request()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_sessions s
    WHERE s.session_token = NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-session-token', '')::uuid
      AND s.role = 'demo' AND s.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.block_demo_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_demo_request() THEN
    RAISE EXCEPTION 'La cuenta demo es de solo lectura';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['rooms','guests','stays','companies','hotel_config','floor_plan_config','floor_plan_elements','app_users','tenant_messages']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS block_demo_writes ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER block_demo_writes BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.block_demo_writes()', table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  v_tenant uuid;
  v_room_101 uuid; v_room_102 uuid; v_room_103 uuid; v_room_201 uuid; v_room_202 uuid; v_room_203 uuid;
  v_guest_1 uuid; v_guest_2 uuid; v_guest_3 uuid; v_guest_4 uuid; v_guest_5 uuid;
BEGIN
  INSERT INTO public.tenants (name, slug, status, plan_name, trial_ends_at)
  VALUES ('Hotel Demo ValStay', 'demo-valstay', 'active', 'Demostración', 'infinity'::timestamptz)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, status = 'active', plan_name = 'Demostración'
  RETURNING id INTO v_tenant;

  INSERT INTO public.app_users (username, password, role, display_name, tenant_id)
  VALUES ('demo', 'Demo2026', 'demo', 'Visitante Demo', v_tenant)
  ON CONFLICT (tenant_id, username) DO UPDATE
  SET password = EXCLUDED.password, role = 'demo', display_name = EXCLUDED.display_name;

  -- Visible sample users. Their random passwords are not exposed or used for the tour.
  INSERT INTO public.app_users (username, password, role, display_name, tenant_id) VALUES
    ('demo_administradora', gen_random_uuid()::text, 'admin', 'Andrea Torres', v_tenant),
    ('demo_recepcion', gen_random_uuid()::text, 'receptionist', 'Carlos Peña', v_tenant)
  ON CONFLICT (tenant_id, username) DO UPDATE
  SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;

  INSERT INTO public.companies (name, tenant_id)
  SELECT company_name, v_tenant
  FROM unnest(ARRAY['MMG', 'Minera Andina']) AS demo_companies(company_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.tenant_id = v_tenant AND c.name = company_name
  );

  INSERT INTO public.hotel_config (tenant_id, name, razon_social, ruc, direccion, cuenta_bancaria, cci, n_detraccion, notifications_enabled, notification_time)
  VALUES (v_tenant, 'Hotel Demo ValStay', 'Servicios Hoteleros Cordillera S.A.C.', '20601234567', 'Av. Principal 245, Challhuahuacho', '0011-0234-567890', '011-001-0234567890-12', '00-123456789', true, '07:00')
  ON CONFLICT (tenant_id) DO UPDATE SET name = EXCLUDED.name, razon_social = EXCLUDED.razon_social, ruc = EXCLUDED.ruc, direccion = EXCLUDED.direccion;

  INSERT INTO public.rooms (number, floor, type, capacity, price_per_night, status, tenant_id) VALUES
    ('101',1,'single',1,80,'available',v_tenant), ('102',1,'double',2,120,'occupied',v_tenant),
    ('103',1,'single',1,85,'cleaning',v_tenant), ('201',2,'double',2,125,'occupied',v_tenant),
    ('202',2,'suite',3,180,'occupied',v_tenant), ('203',2,'single',1,90,'available',v_tenant)
  ON CONFLICT (tenant_id, number) DO UPDATE SET status = EXCLUDED.status, price_per_night = EXCLUDED.price_per_night;

  SELECT id INTO v_room_101 FROM public.rooms WHERE tenant_id=v_tenant AND number='101';
  SELECT id INTO v_room_102 FROM public.rooms WHERE tenant_id=v_tenant AND number='102';
  SELECT id INTO v_room_103 FROM public.rooms WHERE tenant_id=v_tenant AND number='103';
  SELECT id INTO v_room_201 FROM public.rooms WHERE tenant_id=v_tenant AND number='201';
  SELECT id INTO v_room_202 FROM public.rooms WHERE tenant_id=v_tenant AND number='202';
  SELECT id INTO v_room_203 FROM public.rooms WHERE tenant_id=v_tenant AND number='203';

  INSERT INTO public.guests (dni,name,phone,email,address,tenant_id) VALUES
    ('70010001','Lucía Mendoza Torres','987654321','lucia@demo.pe','Cusco',v_tenant),
    ('70010002','Diego Salazar Rojas','986123456','diego@demo.pe','Arequipa',v_tenant),
    ('70010003','Elena Quispe Huamán','985456123','elena@demo.pe','Apurímac',v_tenant),
    ('70010004','Marco Flores Paredes','984321654','marco@demo.pe','Lima',v_tenant),
    ('70010005','Rosa Condori Mamani','983654987','rosa@demo.pe','Puno',v_tenant)
  ON CONFLICT (tenant_id,dni) DO UPDATE SET name=EXCLUDED.name, phone=EXCLUDED.phone;

  SELECT id INTO v_guest_1 FROM public.guests WHERE tenant_id=v_tenant AND dni='70010001';
  SELECT id INTO v_guest_2 FROM public.guests WHERE tenant_id=v_tenant AND dni='70010002';
  SELECT id INTO v_guest_3 FROM public.guests WHERE tenant_id=v_tenant AND dni='70010003';
  SELECT id INTO v_guest_4 FROM public.guests WHERE tenant_id=v_tenant AND dni='70010004';
  SELECT id INTO v_guest_5 FROM public.guests WHERE tenant_id=v_tenant AND dni='70010005';

  DELETE FROM public.stays WHERE tenant_id = v_tenant;
  INSERT INTO public.stays (guest_id,room_id,check_in_date,check_out_date,status,total_amount,empresa,worker_type,notes,tenant_id,payment_method) VALUES
    (v_guest_1,v_room_102,current_date-3,current_date+4,'active',840,'MMG','staff','Personal staff',v_tenant,NULL),
    (v_guest_2,v_room_201,current_date-7,current_date,'active',875,'MMG','obrero','Salida programada hoy',v_tenant,NULL),
    (v_guest_3,v_room_202,current_date-2,current_date+8,'active',1800,'Minera Andina','empleado','Personal empleado',v_tenant,NULL),
    -- Ranges intentionally overlap so the demo valuation displays several workers in one period.
    (v_guest_1,v_room_101,current_date-14,current_date-5,'completed',655,'MMG','staff','Valorización MMG - personal staff',v_tenant,NULL),
    (v_guest_2,v_room_102,current_date-18,current_date-9,'completed',412,'MMG','obrero','Valorización MMG - personal obrero',v_tenant,NULL),
    (v_guest_3,v_room_201,current_date-15,current_date-4,'completed',660,'Minera Andina','empleado','Valorización empresa - personal empleado',v_tenant,NULL),
    (v_guest_4,v_room_202,current_date-13,current_date-3,'completed',605,'MMG','empleado','Valorización MMG - personal empleado',v_tenant,NULL),
    (v_guest_5,v_room_203,current_date-12,current_date-4,'completed',371,'Minera Andina','obrero','Valorización empresa - personal obrero',v_tenant,NULL),
    (v_guest_5,v_room_203,current_date-30,current_date-20,'completed',900,NULL,NULL,'Pago particular',v_tenant,'yape');
END $$;

GRANT EXECUTE ON FUNCTION public.is_demo_request() TO anon, authenticated;
