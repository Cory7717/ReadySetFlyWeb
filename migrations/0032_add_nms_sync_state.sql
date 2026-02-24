CREATE TABLE IF NOT EXISTS "nms_sync_state" (
  "key" text PRIMARY KEY,
  "value" text,
  "updated_at" timestamp DEFAULT now()
);
