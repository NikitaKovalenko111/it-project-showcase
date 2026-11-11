ALTER TABLE showcase.companies
    ADD COLUMN internship_program TEXT NOT NULL DEFAULT '' CHECK (char_length(internship_program) <= 15000),
    ADD COLUMN practice_program TEXT NOT NULL DEFAULT '' CHECK (char_length(practice_program) <= 15000);
