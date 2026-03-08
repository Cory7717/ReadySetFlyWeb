CREATE TABLE IF NOT EXISTS ai_tool_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  anon_id VARCHAR(64),
  tool_type VARCHAR(50) NOT NULL,
  ip_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_usages_user_tool
  ON ai_tool_usages (user_id, tool_type);

CREATE INDEX IF NOT EXISTS idx_ai_tool_usages_anon_tool
  ON ai_tool_usages (anon_id, tool_type);

CREATE INDEX IF NOT EXISTS idx_ai_tool_usages_created_at
  ON ai_tool_usages (created_at);
