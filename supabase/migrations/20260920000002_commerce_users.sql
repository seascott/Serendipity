-- Commerce, user, and ops tables (including empty marketplace tables).

create table provider (
  id text primary key,
  kind text not null check (kind in ('affiliate', 'marketplace')),
  tracking_template text,
  attribution_window_days int,
  commission_pct numeric,
  terms_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supplier (
  id uuid primary key,
  provider_id text references provider (id),
  external_id text,
  name text,
  place_id uuid references place (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, external_id)
);

create table place_external_ref (
  place_id uuid references place (id),
  provider_id text references provider (id),
  external_id text,
  kind text,
  primary key (provider_id, external_id)
);

create table booking_offer (
  id uuid primary key,
  provider_id text not null references provider (id),
  supplier_id uuid references supplier (id),
  external_id text,
  title text,
  kind text check (kind in ('tour', 'activity', 'stay')),
  place_id uuid references place (id),
  price_from_minor int,
  currency char(3),
  price_as_of timestamptz,
  rating numeric(2, 1),
  review_count int,
  duration_minutes int,
  image_url text,
  cancellation_policy text,
  url text,
  deep_link_params jsonb,
  valid tstzrange,
  active bool not null default true,
  last_seen_in_feed_at timestamptz,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (provider_id, external_id)
);
create index booking_offer_place on booking_offer (place_id) where active;

create table offer_phenomenon (
  offer_id uuid references booking_offer (id) on delete cascade,
  phenomenon_id uuid references phenomenon (id),
  primary key (offer_id, phenomenon_id)
);

create table offer_availability (
  offer_id uuid references booking_offer (id) on delete cascade,
  during tstzrange not null,
  capacity int,
  price_minor int,
  currency char(3)
);

create table affiliate_click (
  id bigint generated always as identity primary key,
  click_id text not null unique,
  clicked_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  anon_id uuid,
  session_id text,
  offer_id uuid not null references booking_offer (id),
  provider_id text references provider (id),
  occurrence_id uuid references occurrence (id) on delete set null,
  phenomenon_id uuid,
  place_id uuid,
  landing_page_id uuid,
  surface text,
  device text,
  country char(2),
  referrer text,
  variant text,
  ua_hash text,
  ip_hash text,
  context jsonb
);
create index affiliate_click_time on affiliate_click (clicked_at);
create index affiliate_click_anon_offer on affiliate_click (anon_id, offer_id, clicked_at)
  where anon_id is not null;

create table conversion (
  id uuid primary key,
  click_id text references affiliate_click (click_id),
  provider_id text references provider (id),
  provider_booking_ref text,
  status text check (status in ('pending', 'confirmed', 'cancelled', 'paid')),
  gross_minor int,
  commission_minor int,
  currency char(3),
  booked_at timestamptz,
  travel_date date,
  paid_at timestamptz,
  imported_at timestamptz default now(),
  raw jsonb,
  unique (provider_id, provider_booking_ref)
);

create table booking (
  id uuid primary key,
  user_id uuid,
  offer_id uuid references booking_offer (id),
  occurrence_id uuid,
  provider_id text references provider (id),
  status text,
  gross_minor int,
  currency char(3),
  commission_minor int,
  click_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table fx_rate (
  base char(3),
  quote char(3),
  rate numeric not null,
  as_of date not null,
  primary key (base, quote, as_of)
);

create table profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interests family[],
  units text,
  home_place_id uuid references place (id),
  locale text,
  currency char(3),
  updated_at timestamptz not null default now()
);

create table device (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  expo_push_token text unique,
  platform text,
  last_seen_at timestamptz,
  coarse_geom geography(point, 4326),
  locale text
);
create index device_user on device (user_id);

create table trip (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_owner on trip (owner_id);

create table trip_leg (
  id uuid primary key,
  trip_id uuid not null references trip (id) on delete cascade,
  place_id uuid references place (id),
  dates daterange not null,
  position int,
  updated_at timestamptz not null default now()
);

create table trip_item (
  id uuid primary key,
  trip_id uuid not null references trip (id) on delete cascade,
  leg_id uuid references trip_leg (id) on delete cascade,
  occurrence_id uuid references occurrence (id) on delete set null,
  offer_id uuid references booking_offer (id),
  status text,
  position int,
  updated_at timestamptz not null default now()
);

create table save (
  user_id uuid not null references auth.users (id) on delete cascade,
  phenomenon_id uuid not null references phenomenon (id),
  place_id uuid references place (id),
  note text,
  remind_days_before int,
  updated_at timestamptz not null default now(),
  primary key (user_id, phenomenon_id, place_id)
);

create table alert (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text,
  params jsonb,
  active bool default true,
  updated_at timestamptz not null default now()
);
create index alert_user on alert (user_id);

create table contribution (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text,
  payload jsonb,
  status text default 'pending',
  created_at timestamptz default now()
);

create table report (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  phenomenon_id uuid not null references phenomenon (id),
  place_id uuid references place (id),
  occurrence_id uuid references occurrence (id) on delete set null,
  seen_at date not null,
  rating int check (rating between 1 and 5),
  note text,
  photo_path text,
  geom geography(point, 4326),
  created_at timestamptz not null default now()
);
create index report_phen_seen on report (phenomenon_id, seen_at);
create index report_user on report (user_id);

create table config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table event (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  session_id text,
  user_id uuid,
  name text not null,
  props jsonb
);

insert into provider (id, kind) values
  ('viator', 'affiliate'),
  ('gyg', 'affiliate'),
  ('booking', 'affiliate'),
  ('own', 'marketplace');

insert into config (key, value) values
  (
    'rank_weights',
    '{"w1":0.35,"w2":0.25,"w3":0.20,"w4":0.10,"w5":0.10}'::jsonb
  ),
  ('engine_version', '"0.1.0"'::jsonb);
