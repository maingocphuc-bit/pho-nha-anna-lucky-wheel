# PHỞ NHÀ ANNA – FINAL PRODUCTION v16

## Root-cause fixes verified

### 1. Admin status/history server error
The production build had two live references to `syncCycleState(env)`, but that helper no longer existed. This caused `/api/admin/status` and `/api/admin/cycle-config` to throw and be converted by the Worker catch-all into `Lỗi máy chủ. Vui lòng thử lại.`.

Both references now call the existing `reconcileCycleState(env)` helper.

### 2. Admin F5/session
Cookie and `X-Admin-Token` are now checked independently. A stale cookie can no longer mask a valid header token from localStorage/sessionStorage. The session endpoint also checks both candidates and refreshes the valid session cookie.

### 3. 600-cycle counter
Successful `plays` rows are the source of truth. Reconciliation compacts legacy cycle positions and anchors the active position to the actual successful-play count. A failed spin insert does not commit the new cycle position.

Verified with a local SQLite simulation: a stale state of 30 with 26 successful plays is reconciled to 26; a simulated failed insert leaves the position unchanged.

### 4. Admin UI
- Extra-turn unlock section present.
- Prize check/redeem immediately follows extra-turn unlock.
- Delete-one and delete-all controls present.
- Delete-all requires exact `XOA TAT CA` in the custom confirmation modal.
- Change-password controls present.
- QR scanner is a modal.

### 5. Customer page
Existing customer API remains server-authoritative for daily limits/unlocks; page refresh logic remains enabled.

## Static tests
- `node --check src/worker.js`: PASS
- Extracted `public/admin.html` inline JavaScript: PASS
- Extracted `public/index.html` inline JavaScript: PASS
- `syncCycleState` references: 0
- `reconcileCycleState` references: present and defined
- Admin DOM reference audit: PASS
- Native `confirm()` / `prompt()` in Admin: none
- ZIP integrity: PASS

## Important deployment rule
Deploy this package as one complete Worker/Assets deployment. Keep the existing D1 database and binding. Do not delete or reset D1.
