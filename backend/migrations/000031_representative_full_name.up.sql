ALTER TABLE showcase.users ADD COLUMN full_name VARCHAR(500);
UPDATE showcase.users
SET full_name=NULLIF(concat_ws(' ',NULLIF(btrim(last_name),''),NULLIF(btrim(first_name),''),NULLIF(btrim(patronymic),'')),'');
ALTER TABLE showcase.users DROP COLUMN last_name, DROP COLUMN first_name, DROP COLUMN patronymic;
-- students keeps its separate personal-name fields.
