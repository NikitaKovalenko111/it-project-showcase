ALTER TABLE showcase.internship_programs ADD COLUMN capacity INTEGER CHECK (capacity BETWEEN 1 AND 10000);

CREATE TABLE showcase.internship_applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES showcase.internship_programs(program_id),
    student_id UUID NOT NULL REFERENCES showcase.students(user_id),
    cover_letter TEXT NOT NULL DEFAULT '' CHECK (length(cover_letter)<=4000),
    resume_file_id UUID REFERENCES showcase.files(file_id),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','rejected','withdrawn')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX internship_application_active_uq ON showcase.internship_applications(program_id,student_id) WHERE status NOT IN ('rejected','withdrawn');
CREATE INDEX internship_application_queue_idx ON showcase.internship_applications(program_id,created_at DESC,application_id DESC);
CREATE INDEX internship_application_student_idx ON showcase.internship_applications(student_id,created_at DESC,application_id DESC);

CREATE TABLE showcase.case_views (
    case_id UUID NOT NULL REFERENCES showcase.cases(case_id),
    user_id UUID NOT NULL REFERENCES showcase.users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (case_id,user_id)
);
