# PHỞ NHÀ ANNA — V10.8 SERVER REPAIR TEST REPORT

## Source
Directly repaired from the owner's supplied `PHO_NHA_ANNA_LUCKY_WHEEL_V10_7_FIXED_SERVER_CAMERA.zip`.

## Root causes confirmed
1. **Spin failure on D1:** the previous `reserveCyclePosition()` used `UPDATE ... RETURNING` and read `result.results[0]`. Cloudflare D1 documents that `run()` results are empty for write operations, so the reservation could return null and the customer saw the generic server error.
2. **Legacy D1 schema failure:** `ensureCoreTables()` created indexes on `plays.reward_code` before repairing an older `plays` table that could lack that column. That could make multiple Admin/Index APIs fail with the same generic server error.
3. **Legacy customer uniqueness dependency:** `/api/register` relied on `ON CONFLICT(phone)`, which is unsafe for an older `customers` table without the expected UNIQUE constraint. Registration is now explicit SELECT → UPDATE/INSERT and does not require that legacy constraint.
4. **Concurrent cycle reservation:** customer-only locks were not sufficient when different customers spun simultaneously. A dedicated global cycle reservation lock now serializes the cycle counter and keeps the server-side consecutive-win protection deterministic.

## Repairs
- Legacy `customers` columns repaired before indexes.
- Legacy `plays` columns repaired before indexes, including `reward_code`, `cycle_no`, `cycle_position`, `cycle600_no`, `cycle600_position`, `redemption_count`, and `expires_at`.
- Index creation moved after column repair.
- Register flow no longer depends on `ON CONFLICT(phone)`.
- Cycle position reservation changed to D1-compatible UPDATE + SELECT logic.
- Global cycle reservation lock added with stale-lock recovery.
- Existing customer/play data is preserved; no destructive migration is required.
- Camera modal and PHỞ NHÀ ANNA dialogs from V10.7 are retained.

## Automated checks
- `node --check src/worker.js`: PASS
- Legacy SQLite schema simulation with missing `reward_code`/cycle/daily/config columns: PASS
- Register against legacy customer schema without UNIQUE(phone): PASS
- Cycle reservation UPDATE + SELECT simulation: PASS
- No `UPDATE ... RETURNING` remains in cycle reservation: PASS
- Admin camera modal remains present: PASS

## Live deployment boundary
This environment cannot access the owner's live Cloudflare D1/Workers production instance. The package is source/schema tested. After deployment, the real workers.dev URL must be smoke-tested for register, spin, admin login, unlock, delete, history, redeem, and camera permission.
