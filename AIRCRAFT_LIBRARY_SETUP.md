# Aircraft Specs Library Setup

This repo includes an RSF-owned aircraft library plus user-specific aircraft profiles.

Local setup:
1) Run migrations:
   - `node run-migration.js`
2) Seed the RSF aircraft types:
   - `npm run seed:aircraft-types`

Notes:
- Seed values are planning estimates only.
- Update the library via the admin page at `/admin/aircraft-library`.
