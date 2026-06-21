# DECISIONS.md — MedFinder EG

A running log of scope calls and deferrals, per the playbook (Part 6). Anything
pushed past the MVP loop lives here so we don't lose the thread across sessions.

## Locked-in (MVP scope)
- **One district only.** No multi-city / multi-tenant. (Playbook Part 0, rule 1.)
- **No inventory.** The pharmacist's eyes are the data source. (Part 0.)
- **Connection layer only.** No payments, no dispensing, no controlled substances.
- **The metric is FILL RATE.** Everything in Phases 1–4 exists to measure it.

## Kill criteria (decided now, while objective — Part 7)
- **Validation gate:** < ~20 of 40 pharmacies willing to join + reply → kill.
- **After Phase 4:** after ~2 weeks of real requests in one well-stocked
  district, fill rate < **50%** OR median confirmation time too slow to beat
  "just call a few pharmacies" → kill or pivot.
- **Anti-signal:** pharmacies stop replying after week one (ping fatigue) → fix
  the incentive or kill.

## Deferred until Phase 4 proves fill rate (Part 5, Phase 5)
- Smart routing (only ping pharmacies likely to stock / responsive).
- Anti-spam / quiet hours for pharmacies.
- Alternative suggestions (same active ingredient, different brand).
- Responsiveness scoring to prioritize reliable pharmacies.
- Delivery, payments, Flutter app, second district.

## Implementation notes
- **Request expiry:** 20 minutes (Phase 3 spec) → status `expired`.
- **Default search radius:** 2 km, configurable via `SEARCH_RADIUS_KM`.
- **Fuzzy match:** Postgres `pg_trgm` in production; a pure-TS trigram +
  Arabic-normalization mirror (`src/lib/search`) makes Phase 1's matching
  unit-testable offline without a live DB. Both share the same normalization so
  behavior stays consistent.
