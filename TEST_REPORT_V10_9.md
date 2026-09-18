# PHỞ NHÀ ANNA — V10.9 SERVER HARDENING

## Source
Built directly from the supplied `PHO_NHA_ANNA_LUCKY_WHEEL_V10_8_FIXED_SERVER_FINAL.zip`.

## Additional repair in V10.9
- Hardened all additive D1 schema repairs against first-request concurrency. Two requests can no longer both observe a missing column and turn a harmless duplicate-column race into a generic HTTP 500.
- Hardened index creation against harmless first-deployment races.
- Kept the V10.8 D1 cycle reservation fix (no `UPDATE ... RETURNING` result dependency).
- Kept legacy-schema repair ordering before indexes.
- Kept explicit customer registration without depending on `UNIQUE(phone)`.
- Kept the global cycle reservation lock and customer spin lock.

## Checks
- `node --check src/worker.js`: PASS
- ZIP integrity: PASS
- Source scan: no `UPDATE ... RETURNING` in cycle reservation.

## Important live-deployment condition
The Worker must be deployed with the D1 binding named `DB` pointing to database `pho-nha-anna` / the configured database ID in `wrangler.toml`. A source ZIP cannot create a D1 binding in a manually uploaded Worker if that binding was not attached in Cloudflare.
