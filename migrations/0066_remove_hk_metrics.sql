UPDATE "users"
SET
  "admin_role" = NULL,
  "admin_permissions" = array_remove("admin_permissions", 'hk-metrics')
WHERE "admin_role" = 'housekeeping'
   OR "admin_permissions" @> ARRAY['hk-metrics']::text[];

DELETE FROM "admin_invites"
WHERE "role" = 'housekeeping';

UPDATE "admin_invites"
SET "permissions" = array_remove("permissions", 'hk-metrics')
WHERE "permissions" @> ARRAY['hk-metrics']::text[];

DROP TABLE IF EXISTS "hk_rooms_sold_imports";
DROP TABLE IF EXISTS "hk_attendant_metrics";
DROP TABLE IF EXISTS "hk_daily_metrics";
