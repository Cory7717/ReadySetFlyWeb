ALTER TABLE tips_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'employee';

UPDATE tips_users
SET role = 'super_admin'
WHERE lower(email) = 'coryarmer@gmail.com';
