# MedFinder EG (مِدفايندر)

A live medicine-finder for Egypt. A patient requests a drug + location → nearby
pharmacies get pinged via Telegram → a pharmacist taps "I have it" → the patient
sees the match live. **We are a connection layer — not a pharmacy, no inventory.**

The whole thing exists to measure one number: **FILL RATE** (% of requests
confirmed in stock within ~15 min in one district). See `CLAUDE.md` and
`DECISIONS.md` for the guardrails and kill criteria.

---

## What's built (playbook Phases 1–4)

| Phase | What | Where |
|---|---|---|
| 1 | Schema + drug catalog + fuzzy `searchDrug` (AR/EN/misspelled) | `supabase/migrations/`, `src/lib/search/`, `supabase/seed/` |
| 2 | Telegram bot: register, ping, tap-to-reply (warm Arabic) | `supabase/functions/telegram-bot/` |
| 3 | Patient PWA: request → PostGIS fan-out → live status | `src/app/page.tsx`, `src/app/api/request`, `src/app/status` |
| 4 | Auth-gated fill-rate dashboard | `src/app/dashboard`, `src/app/api/metrics`, `0003_dashboard.sql` |

The patient PWA and pharmacist Telegram messages are in **warm Egyptian Arabic**
(RTL). The internal ops dashboard is in English.

---

## Tests

```bash
npm install
npm test          # 69 tests, no DB needed
```

- **Phase 1 gate:** `بانادول`, `Panadol`, `panadl` all return **Panadol**.
- **Catalog quality:** the matcher is run over the full 132-drug Egypt catalog
  for English brands, Arabic brands, misspellings, and generics
  (`tests/catalog.test.ts`).
- **API routes:** request / status / metrics / login / cron handlers tested with
  a mocked Supabase client (`tests/api.test.ts`).
- **Helpers:** rate limiter, Telegram callback codec, drug labels.

### SQL layer (needs Postgres + PostGIS)
The RPCs and views are verified end-to-end by `supabase/tests/functions_test.sql`
(fuzzy search, geo radius, fan-out, match/no-stock, expiry, dashboard views).
See the header of that file for the run command.

---

## Setup (to run the full loop)

1. **Supabase project** → run the migrations in order:
   ```
   supabase/migrations/0001_init.sql        # schema, pg_trgm, PostGIS
   supabase/migrations/0002_functions.sql   # search / fan-out / responses RPCs
   supabase/migrations/0003_dashboard.sql   # metric views
   supabase/migrations/0004_realtime_rls.sql# RLS + realtime
   ```
2. **Env** → copy `.env.example` to `.env.local` and fill in the values.
3. **Seed the catalog**:
   ```bash
   npm run seed supabase/seed/drugs.egypt.csv  # 132 common Egyptian-market drugs
   npm run seed                                # or the tiny sample CSV
   npm run seed path/to/eda.csv                # or your own EDA export
   ```
   Regenerate/extend the Egypt catalog with `npm run catalog`.
4. **Telegram bot** → deploy and register the webhook (one command):
   ```bash
   supabase functions deploy telegram-bot --no-verify-jwt
   npm run set-webhook https://<project>.supabase.co/functions/v1/telegram-bot
   # uses TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET from your env
   ```
5. **Request expiry** → pick one:
   - **Vercel:** `vercel.json` already schedules `/api/cron/expire` every minute
     (set `CRON_SECRET`).
   - **Supabase only:** run `supabase/migrations/0005_cron.sql` (needs pg_cron).
6. **Run the PWA**:
   ```bash
   npm run dev
   ```

PWA icons are generated and committed; regenerate with `npm run icons`.

### Per-phase tests (from the playbook)
- **Phase 1:** `npm test` — three spellings → right match. ✅ runnable now.
- **Phase 2:** register your own phone as a fake pharmacy, send a test ping, tap
  "عندي", see the `request_pharmacies` row update.
- **Phase 3:** two phones — request on the PWA, ping arrives in Telegram, tap
  "عندي", patient screen updates live.
- **Phase 4:** run ~10 real requests, open `/dashboard`, read the fill rate.

---

## Delivered hardening (beyond the four phases)
- **PWA installable:** real maskable icons + `apple-touch-icon`, service worker
  (offline app shell; API calls always go to network).
- **Honest metrics:** request expiry runs on a schedule (Vercel cron or
  pg_cron), not just lazily on page view.
- **Anti ping-spam:** per-IP sliding-window throttle on `/api/request` (5 / 5min,
  configurable) — guards the pharmacy ping-fatigue the playbook warns about.
- **Clear failures:** missing env vars throw an actionable message.
- **CI:** GitHub Actions runs typecheck + tests + build on every push.
- **Tests:** 21 total — fuzzy-match gate, rate limiter, callback parsing, labels.

## Scope discipline
Forbidden in the MVP (see `CLAUDE.md`): Kubernetes, microservices, queues,
Redis, Flutter, payments, delivery, inventory sync, multi-city, multi-tenant.
Deferred items live in `DECISIONS.md`.
