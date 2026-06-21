# Project: MedFinder EG

## What we're building
A live medicine-finder for Egypt. A patient requests a drug + location; nearby
pharmacies get pinged via Telegram; a pharmacist checks their own shelf and taps
"I have it"; the patient is shown the match. We are a CONNECTION LAYER.

## Non-negotiable principles
- We do NOT store, sync, or track pharmacy inventory. The pharmacist's manual
  shelf-check is the data source. Reject any design that needs digital stock data.
- We are NOT a pharmacy. No dispensing, no payments for drugs, no handling
  prescription/controlled substances. Connection only.
- The product exists to measure ONE metric: FILL RATE (% of requests confirmed
  in stock within ~15 min, in one district). Optimize for measuring it fast.
- Hyperlocal MVP: one district only. No multi-city, no multi-tenant.

## Stack (do not add to this without asking me)
- Next.js (App Router, TypeScript) PWA — patient-facing
- Supabase (Postgres + Auth + Edge Functions + Realtime) — backend
- Telegram Bot API — pharmacy-facing
- pg_trgm for drug fuzzy match, PostGIS for geo radius

## Explicitly forbidden in the MVP
Kubernetes, microservices, NATS, Redis, Flutter, payments, delivery, inventory
systems, multi-city, multi-tenant abstractions. If a task seems to need one of
these, STOP and tell me why — don't add it silently.

## Working style
- Keep changes small and testable. End each phase with a concrete test I can run.
- Prefer boring, simple solutions. This is a validation MVP, not production infra.
- When unsure about scope, ask before building.
