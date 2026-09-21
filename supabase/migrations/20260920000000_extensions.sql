create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists ltree with schema extensions;

-- Optional ops extensions; nightly jobs and revalidation use them later.
do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when others then
    raise notice 'pg_cron not available: %', sqlerrm;
end;
$$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception
  when others then
    raise notice 'pg_net not available: %', sqlerrm;
end;
$$;

create type family as enum (
  'wildlife',
  'astronomy',
  'cultural',
  'seasonal_nature',
  'activity'
);

create type occurrence_scope as enum ('place', 'area', 'global');
