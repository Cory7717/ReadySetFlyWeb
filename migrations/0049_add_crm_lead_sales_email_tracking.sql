ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS marketing_email_opt_out_at timestamp,
  ADD COLUMN IF NOT EXISTS sales_email_last_sent_at timestamp;
