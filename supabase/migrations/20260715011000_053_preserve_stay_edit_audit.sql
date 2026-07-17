-- Audit entries must remain available even if their source stay, guest, or user
-- is removed later. Tenant deletion still removes all tenant-owned audit data.
ALTER TABLE public.stay_edit_audit
  DROP CONSTRAINT IF EXISTS stay_edit_audit_stay_id_fkey,
  DROP CONSTRAINT IF EXISTS stay_edit_audit_guest_id_fkey,
  DROP CONSTRAINT IF EXISTS stay_edit_audit_changed_by_fkey;
