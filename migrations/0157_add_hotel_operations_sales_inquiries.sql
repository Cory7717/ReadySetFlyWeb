-- Separate, privacy-scoped queue for anonymous INNTRIX sales inquiries.
CREATE TABLE IF NOT EXISTS hotel_ops_sales_inquiries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(32) NOT NULL UNIQUE,
  full_name varchar(120) NOT NULL,
  email varchar(320) NOT NULL,
  company_name varchar(200) NOT NULL,
  property_count integer CHECK (property_count IS NULL OR property_count BETWEEN 1 AND 10000),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  assigned_to_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  internal_notes text CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 4000),
  sales_notified_at timestamp,
  confirmation_sent_at timestamp,
  closed_at timestamp,
  retention_expires_at timestamp NOT NULL DEFAULT (now() + interval '24 months'),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_ops_sales_inquiry_queue
  ON hotel_ops_sales_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_sales_inquiry_retention
  ON hotel_ops_sales_inquiries(retention_expires_at);
