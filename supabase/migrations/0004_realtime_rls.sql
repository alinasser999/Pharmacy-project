-- MedFinder EG — RLS + Realtime.
-- Server work uses the service role (bypasses RLS). The only thing the public
-- anon key needs is to RECEIVE realtime reply events for the patient screen,
-- so we expose just request_pharmacies for select (it holds no patient PII —
-- only response/price/note). Enriched pharmacy details are served via the
-- service-role /api/status route, so the pharmacies table stays private.

alter table drugs              enable row level security;
alter table pharmacies         enable row level security;
alter table requests           enable row level security;
alter table request_pharmacies enable row level security;
alter table matches            enable row level security;

-- Anon may read reply rows (needed for realtime trigger on the patient page).
drop policy if exists anon_read_request_pharmacies on request_pharmacies;
create policy anon_read_request_pharmacies
  on request_pharmacies for select
  to anon
  using (true);

-- Add the table to the realtime publication so changes are streamed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'request_pharmacies'
  ) then
    alter publication supabase_realtime add table request_pharmacies;
  end if;
end $$;
