CREATE TABLE IF NOT EXISTS cfi_student_milestones (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar NOT NULL REFERENCES cfi_students(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'not_started',
  due_date date,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_student_milestones_student ON cfi_student_milestones(student_id);

CREATE TABLE IF NOT EXISTS cfi_student_endorsements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar NOT NULL REFERENCES cfi_students(id) ON DELETE CASCADE,
  title text NOT NULL,
  endorsement_type text,
  template_text text,
  issued_at date,
  instructor_name text,
  instructor_certificate text,
  aircraft_type text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  signed_by_name text,
  signature_data_url text,
  signed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_student_endorsements_student ON cfi_student_endorsements(student_id);

CREATE TABLE IF NOT EXISTS cfi_conversations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  cfi_profile_id varchar NOT NULL REFERENCES cfi_profiles(id) ON DELETE CASCADE,
  student_id varchar NOT NULL REFERENCES cfi_students(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cfi_conversations_pair ON cfi_conversations(cfi_profile_id, student_id);
CREATE INDEX IF NOT EXISTS idx_cfi_conversations_profile ON cfi_conversations(cfi_profile_id);
CREATE INDEX IF NOT EXISTS idx_cfi_conversations_student ON cfi_conversations(student_id);

CREATE TABLE IF NOT EXISTS cfi_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id varchar NOT NULL REFERENCES cfi_conversations(id) ON DELETE CASCADE,
  sender_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfi_messages_conversation ON cfi_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cfi_messages_sender ON cfi_messages(sender_user_id);
