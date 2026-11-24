ALTER TABLE showcase.users ADD COLUMN avatar_file_id UUID REFERENCES showcase.files(file_id);
