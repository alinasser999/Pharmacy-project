-- MedFinder EG — Phase 4 metric views. The whole product exists to read these.

-- Overall fill rate: matched / total (excluding still-open requests).
create or replace view v_fill_rate as
select
  count(*) filter (where status = 'matched')                       as matched,
  count(*) filter (where status in ('matched','no_stock','expired')) as resolved,
  count(*)                                                          as total,
  round(
    100.0 * count(*) filter (where status = 'matched')
    / nullif(count(*) filter (where status in ('matched','no_stock','expired')), 0)
  , 1)                                                              as fill_rate_pct
from requests;

-- Fill rate per day.
create or replace view v_fill_rate_daily as
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where status = 'matched') as matched,
  count(*) as total,
  round(
    100.0 * count(*) filter (where status = 'matched')
    / nullif(count(*) filter (where status in ('matched','no_stock','expired')), 0)
  , 1) as fill_rate_pct
from requests
group by 1
order by 1 desc;

-- Median time-to-first-confirmation (seconds).
create or replace view v_time_to_confirm as
select
  percentile_cont(0.5) within group (order by extract(epoch from (m.matched_at - r.created_at))) as median_seconds,
  avg(extract(epoch from (m.matched_at - r.created_at))) as avg_seconds,
  count(*) as confirmed_count
from matches m
join requests r on r.id = m.request_id;

-- Per-pharmacy responsiveness: response rate + avg response time.
create or replace view v_pharmacy_responsiveness as
select
  p.id, p.name, p.district,
  count(rp.*)                                          as pinged,
  count(rp.response)                                   as responded,
  round(100.0 * count(rp.response) / nullif(count(rp.*), 0), 1) as response_rate_pct,
  avg(extract(epoch from (rp.responded_at - rp.pinged_at))) filter (where rp.responded_at is not null) as avg_response_seconds
from pharmacies p
left join request_pharmacies rp on rp.pharmacy_id = p.id
group by p.id, p.name, p.district
order by response_rate_pct desc nulls last;

-- Unmatched requests (the demand we failed to fill) — drug + district.
create or replace view v_unmatched_requests as
select
  r.id, r.raw_query, r.status, r.created_at,
  d.brand_name, d.brand_name_ar,
  (select pp.district from pharmacies pp
     order by pp.geom <-> st_setsrid(st_makepoint(r.lng, r.lat), 4326)::geography
     limit 1) as nearest_district
from requests r
left join drugs d on d.id = r.drug_id
where r.status in ('no_stock','expired')
order by r.created_at desc;
