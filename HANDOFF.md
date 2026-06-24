# HANDOFF — MedFinder EG

A one-glance brief so any new session (terminal or web) is oriented in one read.
Start here, then `CLAUDE.md` (rules), `README.md` (how to run), `DECISIONS.md`
(scope + kill criteria).

## What this project is
A live medicine-finder for Egypt. Patient requests a drug + location → nearby
pharmacies get pinged on Telegram → a pharmacist taps "I have it" → patient sees
the match live. **Connection layer only** — no inventory, one district, the whole
point is to measure **FILL RATE**. (Full rationale in `CLAUDE.md`.)

## Current status: Phases 1–4 built, tested, hardened
- **Phase 1 — catalog + fuzzy search:** schema (`pg_trgm` + PostGIS), 132-drug
  Egypt catalog (`supabase/seed/drugs.egypt.csv`), `searchDrug` matcher handling
  Arabic/English/misspellings.
- **Phase 2 — Telegram bot:** `supabase/functions/telegram-bot/` — register via
  location share, ping, tap-only inline-button replies. Warm Egyptian Arabic.
- **Phase 3 — patient loop:** PWA request → PostGIS fan-out → Telegram pings →
  live status via Supabase Realtime → 20-min expiry. Arabic RTL UI.
- **Phase 4 — the metric:** auth-gated `/dashboard` with fill rate front-and-
  center, time-to-confirm, per-pharmacy responsiveness, unmatched demand.
- **Hardening:** PWA icons + service worker, scheduled expiry (Vercel cron /
  pg_cron), per-IP anti-spam throttle, env guards, CI, 69 tests.

## How it's verified
- `npm test` → **69 tests** (matcher, full-catalog matching, all 5 API routes,
  helpers). No DB needed.
- SQL layer (RPCs + views) verified end-to-end against real Postgres + PostGIS
  via `supabase/tests/functions_test.sql`.

## What is NOT done yet (the real next steps)
1. **Provision live services** — create a Supabase project, run migrations
   `0001`→`0005`, set env vars (`.env.local` from `.env.example`), `npm run seed
   supabase/seed/drugs.egypt.csv`, create the Telegram bot + `npm run set-webhook`,
   deploy (Vercel). All steps in `README.md`.
2. **Playbook Part 1 (non-code, the actual gate):** walk 30–40 pharmacies in one
   district; <20 willing to join+reply → kill. This is ~70% of the real work.

## Deferred on purpose (do NOT build until fill rate is proven — see DECISIONS.md)
Smart routing, responsiveness scoring, quiet hours, alternative-drug suggestions,
second district, payments/delivery.

## Branch
Work is on `claude/coding-session-a55ypg`. Working tree clean, pushed.
