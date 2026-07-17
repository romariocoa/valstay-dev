-- Add company and worker-type fields to the stay audit trail. IF NOT EXISTS
-- keeps this migration compatible with databases where the historical version
-- was already applied.
ALTER TABLE public.stay_edit_audit
  ADD COLUMN IF NOT EXISTS old_empresa text,
  ADD COLUMN IF NOT EXISTS new_empresa text,
  ADD COLUMN IF NOT EXISTS old_worker_type text,
  ADD COLUMN IF NOT EXISTS new_worker_type text;

-- The edit_stay_details implementation is defined by
-- 20260716010000_055_remove_room_validation_from_stay_edits.sql.
