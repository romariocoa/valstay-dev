-- Persistent valuation rates per tenant and company.
CREATE TABLE public.company_valuation_rates (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name text NOT NULL CHECK (btrim(company_name) <> ''),
  obrero_rate numeric(12,2) NOT NULL DEFAULT 41.20 CHECK (obrero_rate >= 0),
  empleado_rate numeric(12,2) NOT NULL DEFAULT 48.00 CHECK (empleado_rate >= 0),
  staff_rate numeric(12,2) NOT NULL DEFAULT 65.50 CHECK (staff_rate >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, company_name)
);

ALTER TABLE public.company_valuation_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_valuation_rates_select"
ON public.company_valuation_rates FOR SELECT TO anon, authenticated
USING (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session());

CREATE POLICY "company_valuation_rates_insert"
ON public.company_valuation_rates FOR INSERT TO anon, authenticated
WITH CHECK (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session());

CREATE POLICY "company_valuation_rates_update"
ON public.company_valuation_rates FOR UPDATE TO anon, authenticated
USING (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session())
WITH CHECK (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session());

CREATE POLICY "company_valuation_rates_delete"
ON public.company_valuation_rates FOR DELETE TO anon, authenticated
USING (tenant_id = public.get_session_tenant_id() OR public.is_superuser_session());

CREATE TRIGGER block_demo_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.company_valuation_rates
FOR EACH ROW EXECUTE FUNCTION public.block_demo_writes();
