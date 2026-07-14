CREATE SEQUENCE IF NOT EXISTS hotel_config_id_seq START WITH 100;

ALTER TABLE hotel_config
  ALTER COLUMN id SET DEFAULT nextval('hotel_config_id_seq');

SELECT setval('hotel_config_id_seq', COALESCE((SELECT MAX(id) FROM hotel_config), 0) + 1);
