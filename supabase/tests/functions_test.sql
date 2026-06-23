-- End-to-end test of the SQL layer (RPCs + views) against a real Postgres with
-- pg_trgm + PostGIS. Run after applying migrations 0001-0004 to a fresh DB:
--
--   createdb medfinder
--   psql -d medfinder -c "create publication supabase_realtime;" -c "create role anon nologin;"
--   for f in 0001_init 0002_functions 0003_dashboard 0004_realtime_rls; do \
--     psql -d medfinder -f supabase/migrations/$f.sql; done
--   psql -d medfinder -f supabase/tests/functions_test.sql
--
-- Covers: search_drugs, find_nearby_pharmacies, create_request_and_fanout,
-- record_response (has_it + no_stock paths), the zero-pharmacy case,
-- expire_open_requests, and all dashboard views.
\set ON_ERROR_STOP 1
\pset pager off

-- ── Seed a few drugs + pharmacies in Maadi (~lat 29.96, lng 31.25) ──────────
insert into drugs (active_ingredient, brand_name, brand_name_ar, generic_name, strength, form)
values
 ('Paracetamol','Panadol','بانادول','Paracetamol','500mg','tablet'),
 ('Amoxicillin','Augmentin','اوجمنتين','Amoxicillin/Clavulanate','1g','tablet'),
 ('Diclofenac','Cataflam','كتافلام','Diclofenac Potassium','50mg','tablet');

-- Three pharmacies: P1 ~150m, P2 ~1.2km, P3 ~5km (out of 2km radius)
insert into pharmacies (name, telegram_chat_id, lat, lng, district, is_active) values
 ('Near Pharmacy','tg-1', 29.9610, 31.2500, 'Maadi', true),
 ('Mid Pharmacy','tg-2',  29.9700, 31.2520, 'Maadi', true),
 ('Far Pharmacy','tg-3',  30.0100, 31.2500, 'Maadi', true);

\echo '== TEST 1: search_drugs fuzzy (pg_trgm) =='
select brand_name, round(score::numeric,2) as score from search_drugs('Panadol');
select brand_name from search_drugs('augmentin') limit 1;

\echo '== TEST 2: find_nearby_pharmacies within 2km (expect Near + Mid, not Far) =='
select name, round(distance_m::numeric) as dist_m
from find_nearby_pharmacies(29.9610, 31.2500, 2) order by dist_m;

\echo '== TEST 3: create_request_and_fanout (expect 2 ping rows) =='
select count(*) as pinged, count(distinct request_id) as requests
from create_request_and_fanout(
  (select id from drugs where brand_name='Panadol'),
  'بانادول','patient-1', 29.9610, 31.2500, 2, 20);

\echo '== request + fan-out rows persisted =='
select status from requests;
select p.name, rp.response from request_pharmacies rp join pharmacies p on p.id=rp.pharmacy_id order by p.name;

\echo '== TEST 4: record_response has_it -> match + status matched =='
select record_response(
  (select id from requests limit 1),
  (select id from pharmacies where name='Near Pharmacy'),
  'has_it', 22.50, 'اخر علبة');
select status from requests;
select count(*) as matches from matches;

\echo '== TEST 5: no_stock path on a second request =='
select request_id from create_request_and_fanout(
  (select id from drugs where brand_name='Cataflam'),
  'كتافلام','patient-2', 29.9610, 31.2500, 2, 20) limit 1
\gset
select record_response(:'request_id', (select id from pharmacies where name='Near Pharmacy'), 'no_stock');
select record_response(:'request_id', (select id from pharmacies where name='Mid Pharmacy'), 'no_stock');
select status as second_request_status from requests where id = :'request_id';

\echo '== TEST 6: zero-pharmacy area still returns request_id (the bug we fixed) =='
select request_id, pharmacy_id from create_request_and_fanout(
  (select id from drugs where brand_name='Panadol'),
  'بانادول','patient-3', 0.0, 0.0, 2, 20);

\echo '== TEST 7: expire_open_requests =='
update requests set expires_at = now() - interval '1 min' where status='open';
select expire_open_requests() as expired_count;
select status, count(*) from requests group by status order by 1;

\echo '== TEST 8: dashboard views =='
select matched, resolved, total, fill_rate_pct from v_fill_rate;
select * from v_time_to_confirm;
select name, pinged, responded, response_rate_pct from v_pharmacy_responsiveness order by name;
select count(*) as unmatched_rows from v_unmatched_requests;
