ALTER TABLE showcase.internship_programs
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'internship' CHECK (kind IN ('internship', 'practice'));

ALTER TABLE showcase.companies
    ADD COLUMN inn TEXT NOT NULL DEFAULT '' CHECK (inn = '' OR inn ~ '^[0-9]{10}([0-9]{2})?$'),
    ADD COLUMN kpp TEXT NOT NULL DEFAULT '' CHECK (kpp = '' OR kpp ~ '^[0-9]{9}$'),
    ADD COLUMN ogrn TEXT NOT NULL DEFAULT '' CHECK (ogrn = '' OR ogrn ~ '^[0-9]{13}([0-9]{2})?$'),
    ADD COLUMN legal_address TEXT NOT NULL DEFAULT '' CHECK (char_length(legal_address) <= 500);
