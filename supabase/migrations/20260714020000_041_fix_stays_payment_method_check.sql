-- Keep particular payment methods aligned with the check-in form.
ALTER TABLE public.stays
  DROP CONSTRAINT IF EXISTS stays_payment_method_check;

ALTER TABLE public.stays
  ADD CONSTRAINT stays_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('efectivo', 'tarjeta', 'yape', 'plin')
  );
