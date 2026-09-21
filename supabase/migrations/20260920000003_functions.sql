create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function bump_rule_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and (
    new.params is distinct from old.params
    or new.kind is distinct from old.kind
  ) then
    new.version = old.version + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profile (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger place_updated_at before update on place
  for each row execute function set_updated_at();
create trigger phenomenon_updated_at before update on phenomenon
  for each row execute function set_updated_at();
create trigger phenomenon_place_updated_at before update on phenomenon_place
  for each row execute function set_updated_at();
create trigger source_updated_at before update on source
  for each row execute function set_updated_at();
create trigger rule_versioned before update on rule
  for each row execute function bump_rule_version();
create trigger occurrence_updated_at before update on occurrence
  for each row execute function set_updated_at();
create trigger landing_page_updated_at before update on landing_page
  for each row execute function set_updated_at();
create trigger provider_updated_at before update on provider
  for each row execute function set_updated_at();
create trigger supplier_updated_at before update on supplier
  for each row execute function set_updated_at();
create trigger booking_offer_updated_at before update on booking_offer
  for each row execute function set_updated_at();
create trigger booking_updated_at before update on booking
  for each row execute function set_updated_at();
create trigger profile_updated_at before update on profile
  for each row execute function set_updated_at();
create trigger trip_updated_at before update on trip
  for each row execute function set_updated_at();
create trigger trip_leg_updated_at before update on trip_leg
  for each row execute function set_updated_at();
create trigger trip_item_updated_at before update on trip_item
  for each row execute function set_updated_at();
create trigger save_updated_at before update on save
  for each row execute function set_updated_at();
create trigger alert_updated_at before update on alert
  for each row execute function set_updated_at();
create trigger config_updated_at before update on config
  for each row execute function set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function peak_proximity(
  now_ts timestamptz,
  peak tstzrange,
  during tstzrange
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when during is null or isempty(during) then 0
    when peak is not null
      and now_ts >= lower(peak)
      and now_ts < greatest(upper(peak), lower(peak) + interval '1 millisecond')
      then 1.0
    when now_ts >= lower(during) and now_ts < upper(during) then
      case
        when now_ts < coalesce(lower(peak), lower(during) + (upper(during) - lower(during)) / 2) then
          case
            when coalesce(lower(peak), lower(during) + (upper(during) - lower(during)) / 2) = lower(during) then 1.0
            else extract(epoch from (
              now_ts - lower(during)
            )) / extract(epoch from (
              coalesce(lower(peak), lower(during) + (upper(during) - lower(during)) / 2) - lower(during)
            ))
          end
        else
          case
            when upper(during) = coalesce(upper(peak), lower(during) + (upper(during) - lower(during)) / 2) then 1.0
            else extract(epoch from (
              upper(during) - now_ts
            )) / extract(epoch from (
              upper(during) - coalesce(upper(peak), lower(during) + (upper(during) - lower(during)) / 2)
            ))
          end
      end
    else
      exp(
        - extract(epoch from (
            case
              when now_ts < lower(during) then lower(during) - now_ts
              else now_ts - upper(during)
            end
          ))
        / greatest(extract(epoch from (upper(during) - lower(during))), 86400.0)
      )
  end;
$$;

create or replace function travel_band(dist_m double precision, radius_m double precision)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when radius_m <= 0 then 0
    else greatest(0, 1 - (dist_m * 1.4) / radius_m)
  end;
$$;

create or replace function interest_match(tags text[], interests text[])
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when interests is null or cardinality(interests) = 0 then 0
    else least(
      (select count(distinct t) from unnest(coalesce(tags, '{}')) as t where t = any (interests)),
      3
    )::double precision / 3.0
  end;
$$;

create or replace function rank_score(
  during tstzrange,
  peak tstzrange,
  confidence numeric,
  dist_m double precision,
  radius_m double precision,
  now_ts timestamptz,
  tags text[],
  interests text[],
  spectacle smallint default 3
)
returns double precision
language sql
immutable
parallel safe
as $$
  select
    0.35 * peak_proximity(now_ts, peak, during)
    + 0.25 * travel_band(dist_m, radius_m)
    + 0.20 * confidence::double precision
    + 0.10 * interest_match(tags, interests)
    + 0.10 * ((coalesce(spectacle, 3) - 1)::double precision / 4.0);
$$;

create or replace function explore(
  lat double precision,
  lng double precision,
  radius_m double precision,
  from_ts timestamptz,
  to_ts timestamptz,
  families family[] default null,
  interests text[] default null
)
returns table (
  id uuid,
  rule_id uuid,
  phenomenon_id uuid,
  place_id uuid,
  phenomenon_name text,
  place_name text,
  scope occurrence_scope,
  season_key text,
  family family,
  tags text[],
  starts_at timestamptz,
  ends_at timestamptz,
  peak_starts_at timestamptz,
  peak_ends_at timestamptz,
  granularity text,
  confidence numeric,
  lat double precision,
  lng double precision,
  dist_m double precision,
  score double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with here as (
    select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g
  ),
  cand as (
    select
      o.*,
      st_distance(o.geom, here.g, false) as dist_m
    from occurrence o, here
    where o.status = 'published'
      and o.scope <> 'global'
      and st_dwithin(o.geom, here.g, radius_m)
      and o.during && tstzrange(from_ts, to_ts, '[)')
      and (families is null or o.family = any (families))
    union all
    select o.*, 0
    from occurrence o
    where o.scope = 'global'
      and o.status = 'published'
      and o.during && tstzrange(from_ts, to_ts, '[)')
      and (families is null or o.family = any (families))
    limit 2000
  )
  select
    c.id,
    c.rule_id,
    c.phenomenon_id,
    c.place_id,
    p.name,
    pl.name,
    c.scope,
    c.season_key,
    c.family,
    c.tags,
    lower(c.during),
    upper(c.during),
    lower(c.peak),
    upper(c.peak),
    c.granularity,
    c.confidence,
    case when c.geom is null then null else st_y(st_pointonsurface(c.geom::geometry)) end,
    case when c.geom is null then null else st_x(st_pointonsurface(c.geom::geometry)) end,
    c.dist_m,
    rank_score(
      c.during,
      c.peak,
      c.confidence,
      c.dist_m,
      radius_m,
      from_ts,
      c.tags,
      interests,
      p.spectacle
    ) as score
  from cand c
  join phenomenon p
    on p.id = c.phenomenon_id
   and p.status = 'published'
   and p.deleted_at is null
  left join place pl
    on pl.id = c.place_id
   and pl.status = 'published'
   and pl.deleted_at is null
  where c.place_id is null or pl.id is not null
  order by score desc
  limit 50;
$$;

create or replace function get_shared_trip(token text)
returns table (
  id uuid,
  name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.created_at
  from trip t
  where t.share_token = token;
$$;
