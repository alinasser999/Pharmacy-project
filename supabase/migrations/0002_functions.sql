-- MedFinder EG — RPCs for fuzzy drug search, geo fan-out, expiry, and the
-- record-a-reply path. Keep logic in the DB so the API stays a thin caller.

-- search_drugs: trigram fuzzy match over the catalog. The app's primary
-- resolver is the TS matcher (handles AR<->EN transliteration); this RPC is the
-- DB-side equivalent for same-script queries and ad-hoc use.
create or replace function search_drugs(q text, max_results int default 5)
returns table (
  id uuid, brand_name text, brand_name_ar text, generic_name text,
  active_ingredient text, strength text, form text, score real
)
language sql stable as $$
  select d.id, d.brand_name, d.brand_name_ar, d.generic_name,
         d.active_ingredient, d.strength, d.form,
         similarity(d.search_text, q) as score
  from drugs d
  where d.search_text % q
  order by score desc
  limit max_results
$$;

-- find_nearby_pharmacies: active pharmacies within radius_km, nearest first.
create or replace function find_nearby_pharmacies(
  in_lat double precision, in_lng double precision, radius_km double precision default 2
)
returns table (id uuid, name text, telegram_chat_id text, distance_m double precision)
language sql stable as $$
  select p.id, p.name, p.telegram_chat_id,
         st_distance(p.geom, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography) as distance_m
  from pharmacies p
  where p.is_active
    and st_dwithin(p.geom, st_setsrid(st_makepoint(in_lng, in_lat), 4326)::geography, radius_km * 1000)
  order by distance_m asc
$$;

-- create_request_and_fanout: create the request and the request_pharmacies
-- rows in one transaction. Returns the new request id + the pharmacies to ping
-- (chat id + distance), which the API uses to send Telegram messages.
create or replace function create_request_and_fanout(
  in_drug_id uuid,
  in_raw_query text,
  in_patient_contact text,
  in_lat double precision,
  in_lng double precision,
  in_radius_km double precision default 2,
  in_ttl_minutes int default 20
)
returns table (request_id uuid, pharmacy_id uuid, telegram_chat_id text, distance_m double precision)
language plpgsql as $$
declare
  new_request_id uuid;
begin
  insert into requests (drug_id, raw_query, patient_contact, lat, lng, expires_at)
  values (in_drug_id, in_raw_query, in_patient_contact, in_lat, in_lng,
          now() + make_interval(mins => in_ttl_minutes))
  returning id into new_request_id;

  -- The data-modifying CTE always runs to completion even though the final
  -- SELECT reads from `nearby`. The UNION guarantees at least one row carrying
  -- the request_id, so a request in an area with no pharmacies still returns
  -- its id (with null pharmacy fields) instead of an empty result.
  return query
  with nearby as (
    select * from find_nearby_pharmacies(in_lat, in_lng, in_radius_km)
  ), inserted as (
    insert into request_pharmacies (request_id, pharmacy_id)
    select new_request_id, n.id from nearby n
    returning pharmacy_id
  )
  select new_request_id, n.id, n.telegram_chat_id, n.distance_m
  from nearby n
  union all
  select new_request_id, null::uuid, null::text, null::double precision
  where not exists (select 1 from nearby);
end;
$$;

-- record_response: a pharmacist replied. Update the fan-out row and, on the
-- first 'has_it', create the match and flip the request to 'matched'.
create or replace function record_response(
  in_request_id uuid,
  in_pharmacy_id uuid,
  in_response text,
  in_price numeric default null,
  in_note text default null
)
returns void
language plpgsql as $$
begin
  update request_pharmacies
     set response = in_response, responded_at = now(),
         price = in_price, note = in_note
   where request_id = in_request_id and pharmacy_id = in_pharmacy_id;

  if in_response = 'has_it' then
    insert into matches (request_id, pharmacy_id)
    values (in_request_id, in_pharmacy_id)
    on conflict (request_id) do nothing;

    update requests set status = 'matched'
     where id = in_request_id and status = 'open';
  end if;

  -- If everyone pinged has replied and none has it -> no_stock.
  update requests r set status = 'no_stock'
   where r.id = in_request_id and r.status = 'open'
     and not exists (
       select 1 from request_pharmacies rp
        where rp.request_id = in_request_id and rp.response is null
     )
     and not exists (
       select 1 from request_pharmacies rp
        where rp.request_id = in_request_id and rp.response = 'has_it'
     );
end;
$$;

-- expire_open_requests: flip past-deadline open requests to 'expired'.
-- Run on a schedule (pg_cron) or call from the app.
create or replace function expire_open_requests()
returns int
language plpgsql as $$
declare n int;
begin
  update requests set status = 'expired'
   where status = 'open' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
