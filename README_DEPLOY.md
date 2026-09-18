# PHỞ NHÀ ANNA — V10.7 FINAL VERIFIED

## Deploy exactly this package
Deploy the whole folder as a single Worker project. Do not mix `src/worker.js` or `public/admin.html` from an older ZIP.

## Critical fix in V10.7
The Worker now repairs all core columns used by the current application, including legacy `plays.cycle_no` and `plays.cycle_position`. Older D1 schemas that lacked these columns were able to reach the generic `SERVER_ERROR` response during spin/admin operations.

## Tested before delivery
See `TEST_REPORT_V10_7.md` for the complete test matrix.

## Camera
QR camera is rendered as an inline region inside the exchange/redeem card. Chrome/Android may still display its own camera permission prompt; that prompt is controlled by the browser/OS.

## D1
Do not delete the existing D1 database. The Worker performs additive schema repair and preserves existing rows.
