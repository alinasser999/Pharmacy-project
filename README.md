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

## Phase 1 test (runs offline, no DB needed)

The playbook's gate — three spellings of one drug all resolve to Panadol:

```bash
npm install
npm test
```

`بانادول`, `Panadol`, and `panadl` all return **Panadol** (`tests/search.test.ts`).

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
   npm run seed                 # uses the sample CSV
   npm run seed path/to/eda.csv # or your own EDA export
   ```
4. **Telegram bot** → deploy and set the webhook:
   ```bash
   supabase functions deploy telegram-bot --no-verify-jwt
   # then call setWebhook -> .../functions/v1/telegram-bot?secret=<TELEGRAM_WEBHOOK_SECRET>
   ```
5. **Run the PWA**:
   ```bash
   npm run dev
   ```

### Per-phase tests (from the playbook)
- **Phase 1:** `npm test` — three spellings → right match. ✅ runnable now.
- **Phase 2:** register your own phone as a fake pharmacy, send a test ping, tap
  "عندي", see the `request_pharmacies` row update.
- **Phase 3:** two phones — request on the PWA, ping arrives in Telegram, tap
  "عندي", patient screen updates live.
- **Phase 4:** run ~10 real requests, open `/dashboard`, read the fill rate.

---

## Scope discipline
Forbidden in the MVP (see `CLAUDE.md`): Kubernetes, microservices, queues,
Redis, Flutter, payments, delivery, inventory sync, multi-city, multi-tenant.
Deferred items live in `DECISIONS.md`.
