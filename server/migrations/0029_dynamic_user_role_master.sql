ALTER TABLE role_master DROP CONSTRAINT IF EXISTS role_master_id_check;
ALTER TABLE role_master DROP CONSTRAINT IF EXISTS role_master_sort_order_key;
ALTER TABLE role_master ALTER COLUMN sort_order TYPE INTEGER;
ALTER TABLE role_master ADD COLUMN name TEXT;

UPDATE role_master
SET name = initcap(replace(id, '_', ' '));

ALTER TABLE role_master ALTER COLUMN name SET NOT NULL;
CREATE UNIQUE INDEX role_master_name_unique_idx ON role_master (lower(name));
