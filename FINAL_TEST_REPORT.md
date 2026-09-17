# PHỞ NHÀ ANNA – Lucky Wheel FINAL

## Final fixes

1. Admin login
- D1 schema for `admin_credentials` is created/extended automatically.
- Supports existing D1 admin account and optional `ADMIN_PASSWORD` Worker Secret for first-run initialization.
- Login creates a random server-side session in `admin_sessions`.
- HttpOnly Secure SameSite cookie keeps the admin session across F5.
- localStorage/sessionStorage token remains only as compatibility fallback.
- Session lasts 30 days and is revalidated on `/api/admin/session`.

2. Admin UI
- Status
- Open extra task turns
- Prize checking/redeeming
- Daily play configuration
- Cycle/prize quota configuration
- Change admin password
- Delete one customer
- Delete all customers with custom confirmation dialog; exact text `XOA TAT CA` is required.

3. QR camera
- QR scanner is a modal, not an inline page panel.
- Uses native `getUserMedia()` and rear-camera preference.
- Uses `BarcodeDetector` when supported.
- Provides an image QR fallback when direct QR detection is unavailable.
- Closing the modal always stops all camera tracks.

4. Cycle counter
- Successful `plays` rows are the source of truth.
- Old counter gaps are reconciled from actual play rows.
- Latest broken cycle positions are compacted without deleting or inventing plays.
- The cycle counter is committed only after the play row is successfully inserted.
- A global D1 spin lock prevents concurrent spins from sharing a cycle position.
- Pending cycle size/quota changes activate only when the current cycle is actually complete.
- Admin status reports the actual number of successful plays in the active cycle.

5. Customer page
- Customer state is refreshed every 5 seconds while active, so an admin unlock is reflected without manual F5.
- Daily configuration is refreshed without cache.
- Server remains authoritative for play limits and unlock state.

## Tests run

- `node --check src/worker.js`: PASS
- Extracted inline JavaScript from `public/admin.html`: PASS
- Extracted inline JavaScript from `public/index.html`: PASS
- Admin DOM ID/reference audit: 0 missing IDs
- Native `confirm()` / `prompt()` audit in Admin: none
- Camera modal elements present: PASS
- Delete-all confirmation field and exact text check: PASS
- Local SQLite simulation of 30 counter / 26 successful plays reconciliation: PASS
- Local SQLite simulation of spin lock: PASS (first lock succeeds, concurrent second lock rejected)
- ZIP integrity: PASS

## Deployment

Deploy the whole package to the existing Cloudflare Worker and keep the existing D1 binding.
Do not delete the D1 database.
Do not run a destructive migration manually.

## First-run admin setup

If the D1 database does not yet contain an admin account and no `ADMIN_PASSWORD` Worker Secret is configured, the Admin login screen exposes a first-run setup form. The setup endpoint is accepted only while no admin account exists; after creation, the new account is stored in D1 and a normal 30-day session is issued.
