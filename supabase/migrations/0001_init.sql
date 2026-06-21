-- MedFinder EG — initial schema (playbook Part 3)
-- Connection layer only: no inventory tables, no stock columns. Ever.

create extension if not exists pg_trgm;
create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- drugs: the catalog. search_text is generated for the trigram index.
-- ---------------------------------------------------------------------------
create table if not exists drugs (
  id                uuid primary key default uuid_generate_v4(),
  active_ingredient text not null,
  brand_name        text not null,
  brand_name_ar     text,
  generic_name      text,
  strength          text,
  form              text not null default 'other',
  eda_reg_no        text,
  search_text       text generated always as (
                      coalesce(brand_name, '') || ' ' ||
                      coalesce(brand_name_ar, '') || ' ' ||
                      coalesce(generic_name, '') || ' ' ||
                      coalesce(active_ingredient, '')
                    ) stored,
  created_at        timestamptz not null default now()
);

-- Trigram GIN index for fuzzy match on the generated search_text.
create index if not exists drugs_search_text_trgm
  on drugs using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- pharmacies: the supply side. geo is a PostGIS point for radius search.
-- ---------------------------------------------------------------------------
create table if not exists pharmacies (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  phone                text,
  telegram_chat_id     text unique not null,
  lat                  double precision not null,
  lng                  double precision not null,
  geom                 geography(Point, 4326)
                         generated always as (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  district             text not null,
  is_active            boolean not null default true,
  joined_at            timestamptz not null default now(),
  responsiveness_score double precision
);

create index if not exists pharmacies_geom_gix on pharmacies using gist (geom);
create index if not exists pharmacies_active_idx on pharmacies (is_active);

-- ---------------------------------------------------------------------------
-- requests: a patient asking for a drug near a location.
-- ---------------------------------------------------------------------------
create table if not exists requests (
  id              uuid primary key default uuid_generate_v4(),
  drug_id         uuid references drugs(id),
  raw_query       text not null,
  patient_contact text not null,
  lat             double precision not null,
  lng             double precision not null,
  status          text not null default 'open'
                    check (status in ('open','matched','expired','no_stock')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists requests_status_idx on requests (status);
create index if not exists requests_created_idx on requests (created_at);

-- ---------------------------------------------------------------------------
-- request_pharmacies: the fan-out. who got pinged + how they replied.
-- ---------------------------------------------------------------------------
create table if not exists request_pharmacies (
  id           uuid primary key default uuid_generate_v4(),
  request_id   uuid not null references requests(id) on delete cascade,
  pharmacy_id  uuid not null references pharmacies(id),
  pinged_at    timestamptz not null default now(),
  response     text check (response in ('has_it','no_stock','has_alternative')),
  responded_at timestamptz,
  price        numeric(10,2),
  note         text,
  unique (request_id, pharmacy_id)
);

create index if not exists request_pharmacies_req_idx on request_pharmacies (request_id);
create index if not exists request_pharmacies_pharm_idx on request_pharmacies (pharmacy_id);

-- ---------------------------------------------------------------------------
-- matches: the first/best confirmed match for a request.
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid not null references requests(id) on delete cascade,
  pharmacy_id uuid not null references pharmacies(id),
  matched_at  timestamptz not null default now(),
  unique (request_id)
);
