ALTER TABLE showcase.users
 ADD COLUMN last_name VARCHAR(150),
 ADD COLUMN first_name VARCHAR(150),
 ADD COLUMN patronymic VARCHAR(150);
-- Existing accounts remain unchanged; names are required for new representative registrations.
