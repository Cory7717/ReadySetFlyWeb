ALTER TABLE users
ADD COLUMN IF NOT EXISTS pro_trial_offer_sent_at timestamp;
