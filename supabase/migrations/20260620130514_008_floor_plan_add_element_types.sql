ALTER TABLE floor_plan_elements DROP CONSTRAINT IF EXISTS fpe_type_check;
ALTER TABLE floor_plan_elements ADD CONSTRAINT fpe_type_check
  CHECK (element_type IN ('wall', 'stairs', 'elevator', 'door', 'window', 'hallway'));