ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamp,
  ADD COLUMN IF NOT EXISTS email_suppression_reason text,
  ADD COLUMN IF NOT EXISTS email_preferences jsonb;

UPDATE crm_leads
SET
  email_unsubscribed = true,
  email_unsubscribed_at = COALESCE(email_unsubscribed_at, marketing_email_opt_out_at),
  email_suppression_reason = COALESCE(email_suppression_reason, 'user_unsubscribed'),
  email_preferences = COALESCE(
    email_preferences,
    jsonb_build_object(
      'sales', false,
      'product_updates', false,
      'marketplace_updates', false
    )
  )
WHERE marketing_email_opt_out_at IS NOT NULL;
