-- Keep the remote schema aligned with the invite registration functions.
-- Existing users remain unchanged and default to not requiring a reset.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

