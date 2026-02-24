CREATE TABLE IF NOT EXISTS cfi_students (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  cfi_profile_id varchar NOT NULL REFERENCES cfi_profiles(id) ON DELETE CASCADE,
  student_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cfi_students ON cfi_students(cfi_profile_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_cfi_students_profile ON cfi_students(cfi_profile_id);
CREATE INDEX IF NOT EXISTS idx_cfi_students_student ON cfi_students(student_user_id);

CREATE TABLE IF NOT EXISTS cfi_lesson_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  cfi_profile_id varchar NOT NULL REFERENCES cfi_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  lesson_type text DEFAULT 'flight',
  objective text,
  tasks jsonb DEFAULT '[]'::jsonb,
  estimated_minutes integer,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_lesson_templates_profile ON cfi_lesson_templates(cfi_profile_id);

CREATE TABLE IF NOT EXISTS cfi_lessons (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  cfi_profile_id varchar NOT NULL REFERENCES cfi_profiles(id) ON DELETE CASCADE,
  student_id varchar NOT NULL REFERENCES cfi_students(id) ON DELETE CASCADE,
  template_id varchar REFERENCES cfi_lesson_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  lesson_type text,
  objective text,
  tasks jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planned',
  scheduled_at timestamp,
  completed_at timestamp,
  instructor_notes text,
  student_notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_lessons_student ON cfi_lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_cfi_lessons_profile ON cfi_lessons(cfi_profile_id);

CREATE TABLE IF NOT EXISTS cfi_student_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar NOT NULL REFERENCES cfi_students(id) ON DELETE CASCADE,
  uploaded_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size_bytes integer,
  storage_provider text NOT NULL DEFAULT 'object',
  storage_path text NOT NULL,
  mime_type text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_student_files_student ON cfi_student_files(student_id);
