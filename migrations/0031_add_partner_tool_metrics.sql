CREATE TABLE IF NOT EXISTS partner_tool_metrics (
  partner text PRIMARY KEY,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_tool_metrics_partner ON partner_tool_metrics(partner);
