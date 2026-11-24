ALTER TABLE showcase.users
 ADD COLUMN experience_and_interests TEXT NOT NULL DEFAULT '' CHECK (char_length(experience_and_interests)<=4000),
 ADD COLUMN help_topics TEXT NOT NULL DEFAULT '' CHECK (char_length(help_topics)<=2000);
