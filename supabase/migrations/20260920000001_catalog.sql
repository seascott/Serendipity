-- Catalog: places, phenomena, rules, occurrences, SEO control plane.

create table place (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  kind text not null check (kind in ('point', 'park', 'city', 'region', 'country')),
  geom geography(geometry, 4326) not null,
  centroid geography(point, 4326) generated always as (st_pointonsurface(geom::geometry)::geography) stored,
  -- st_expand keeps the envelope a polygon for point/degenerate geometries (~11 m pad).
  bbox geometry(polygon, 4326) generated always as (st_envelope(st_expand(geom::geometry, 0.0001))) stored,
  country_code char(2),
  admin_code text,
  timezone text not null,
  elevation_m int,
  geomag_lat numeric(5, 2),
  parent_id uuid references place (id),
  path ltree,
  description_md text,
  hero_image_id uuid,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index place_geom_gist on place using gist (geom);
create index place_path_gist on place using gist (path);

create table phenomenon (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  family family not null,
  tags text[] not null default '{}',
  summary text,
  description_md text,
  practical jsonb,
  spectacle smallint check (spectacle between 1 and 5),
  rarity smallint,
  feasibility jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  contributed_by uuid,
  moderated_by uuid,
  published_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple', name || ' ' || coalesce(summary, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index phenomenon_search_gin on phenomenon using gin (search);
create index phenomenon_tags_gin on phenomenon using gin (tags);

create table phenomenon_i18n (
  phenomenon_id uuid not null references phenomenon (id) on delete cascade,
  lang text not null,
  name text not null,
  summary text,
  description_md text,
  primary key (phenomenon_id, lang)
);

create table place_i18n (
  place_id uuid not null references place (id) on delete cascade,
  lang text not null,
  name text not null,
  description_md text,
  primary key (place_id, lang)
);

create table phenomenon_place (
  phenomenon_id uuid references phenomenon (id) on delete cascade,
  place_id uuid references place (id) on delete cascade,
  description_md text,
  how_to_see_md text,
  best_vantage_md text,
  ethics_md text,
  faq jsonb,
  hero_image_id uuid,
  editor_id uuid,
  reviewed_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phenomenon_id, place_id)
);

create table source (
  id uuid primary key,
  url text,
  title text,
  publisher text,
  license text,
  terms_url text,
  commercial_ok bool,
  last_verified date,
  accessed_at date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table phenomenon_source (
  phenomenon_id uuid references phenomenon (id),
  source_id uuid references source (id),
  primary key (phenomenon_id, source_id)
);

create table rule (
  id uuid primary key,
  phenomenon_id uuid not null references phenomenon (id) on delete cascade,
  place_id uuid references place (id),
  scope occurrence_scope not null default 'place',
  kind text not null check (
    kind in (
      'fixed_annual',
      'rrule',
      'seasonal_band',
      'lunar',
      'astronomical',
      'explicit',
      'cadence',
      'override'
    )
  ),
  params jsonb not null,
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  version int not null default 1,
  active bool not null default true,
  source_id uuid references source (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rule_phenomenon on rule (phenomenon_id);
create index rule_place on rule (place_id);

create table rule_materialization (
  rule_id uuid references rule (id) on delete cascade,
  season_year int not null,
  rule_version int not null,
  engine_version text not null,
  inputs_hash text not null,
  row_count int not null,
  materialized_at timestamptz not null default now(),
  primary key (rule_id, season_year)
);

create table occurrence (
  id uuid primary key,
  rule_id uuid not null references rule (id) on delete cascade,
  phenomenon_id uuid not null references phenomenon (id) on delete cascade,
  place_id uuid references place (id),
  scope occurrence_scope not null default 'place',
  season_key text not null,
  family family not null,
  tags text[] not null default '{}',
  during tstzrange not null,
  peak tstzrange,
  granularity text not null check (granularity in ('day', 'instant')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  geom geography(geometry, 4326),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  rule_version int not null,
  engine_version text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint occ_during_halfopen check (
    lower_inc(during) and not upper_inc(during) and not isempty(during)
  ),
  constraint occ_peak_in_during check (peak is null or peak <@ during),
  constraint occ_global_no_geom check ((scope = 'global') = (geom is null)),
  constraint occ_place_has_place check (scope <> 'place' or place_id is not null),
  constraint occ_rule_place_season unique nulls not distinct (rule_id, place_id, season_key),
  constraint occ_no_overlap exclude using gist (
    rule_id with =,
    coalesce(place_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    during with &&
  )
);
create index occ_geom_during_gist on occurrence using gist (geom, during)
  where status = 'published' and scope <> 'global';
create index occ_global_during on occurrence using gist (during)
  where scope = 'global';
create index occ_phenomenon on occurrence (phenomenon_id, lower(during));
create index occ_place_during on occurrence (place_id, lower(during));
create index occ_updated_at on occurrence (updated_at);
create index occ_tags_gin on occurrence using gin (tags);

create table landing_page (
  id uuid primary key,
  slug text not null unique,
  kind text not null check (
    kind in ('phenomenon', 'place', 'place_month', 'pair', 'event', 'family', 'calendar_month')
  ),
  phenomenon_id uuid references phenomenon (id),
  place_id uuid references place (id),
  month smallint,
  event_occurrence_id uuid references occurrence (id) on delete set null,
  indexable bool not null default false,
  canonical_slug text,
  title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table slug_redirect (
  old_slug text primary key,
  entity text not null,
  entity_id uuid not null,
  new_slug text not null,
  created_at timestamptz default now()
);
