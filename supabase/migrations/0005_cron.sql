-- MedFinder EG — in-database expiry schedule (alternative to the Vercel cron).
--
-- Use EITHER this pg_cron job OR the /api/cron/expire route, not both. pg_cron
-- must be enabled for your Supabase project (Dashboard → Database → Extensions,
-- or the statement below if your plan allows it).
--
-- This runs expire_open_requests() once a minute so 'open' requests past their
-- deadline flip to 'expired' without anyone opening a page.

create extension if not exists pg_cron;

-- Re-create the schedule idempotently.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'medfinder-expire-requests') then
    perform cron.unschedule('medfinder-expire-requests');
  end if;
  perform cron.schedule(
    'medfinder-expire-requests',
    '* * * * *',
    $cron$ select expire_open_requests(); $cron$
  );
end $$;
