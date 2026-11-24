-- Keep existing INN values and public company card data.
-- New API writes require a valid INN; legacy empty INN values are not fabricated.
ALTER TABLE showcase.companies
 DROP COLUMN kpp,
 DROP COLUMN ogrn,
 DROP COLUMN legal_address;
