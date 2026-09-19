# Serendipity — Design Document (v2, post-review)

*Time + place travel companion: know what the world is doing, where you are (or where you're going), when you're there — and book it.*

> v2 incorporates two independent expert reviews (travel/SEO/monetization and data/geo architecture), both **confirm-with-changes**. Full reports: [`reviews/2026-09-travel-seo-architecture.md`](reviews/2026-09-travel-seo-architecture.md), [`reviews/2026-09-data-geo-architecture.md`](reviews/2026-09-data-geo-architecture.md); consolidated findings and founder decisions: [`reviews/SYNTHESIS.md`](reviews/SYNTHESIS.md). Items marked **[decision]** are reviewer-recommended defaults awaiting founder confirmation.

## 1. Concept

Most travel tools answer "where should I go?" Serendipity answers **"what is happening at this place at this time?"** — and the inverse, **"when/where should I be to catch this?"** — then converts the answer into a booked tour, activity or stay.

Two modes, one dataset, at parity from day one:

| Mode | Input | Output |
|------|-------|--------|
| **Plan** | destination (or region) + date range, *or* a phenomenon | ranked list + calendar of phenomena overlapping the trip; best dates/places to catch a chosen phenomenon; bookable tours/stays for each |
| **Explore** (on the road) | current GPS + "next N days" + radius | what is peaking nearby right now / soon, with travel time, odds, and "book a guide" |

Phenomenon families (v1, global catalog — thin but broad):

- **Wildlife** — migrations (monarchs, wildebeest, gray whales, sandhill cranes), spawning/aggregations (coral spawning, salmon runs, horseshoe crabs, sardine run), blooms (bioluminescence, firefly synchrony, superblooms).
- **Astronomy** — solar/lunar eclipses, meteor showers, aurora season, supermoons, solstices/equinoxes, conjunctions, dark-sky new moons.
- **Cultural** — festivals, national celebrations, religious observances, seasonal markets, sporting traditions.
- **Seasonal nature** — cherry blossom, fall foliage, lavender/tulip fields, monsoon onset, king tides, midnight sun / polar night.
- **Seasonal activities** — whitewater rafting season (snowmelt release), powder/ski season, surf swells, dive visibility windows, heli-hiking, ice climbing, harvest/wine crush, truffle season. These are the most directly bookable family.

## 2. Revenue Model

**Phase A — Affiliate (launch):** every Phenomenon × Place surface carries contextual booking modules: tours/activities (Viator, GetYourGuide), lodging (Booking.com / Expedia affiliate — session-based attribution, do not model as reliable P1 revenue), flights later. Commission on click-through bookings; the app's job is *intent at the right moment* ("humpbacks peak here in 9 days — 3 whale-watch operators, from $85").

**Phase B — Marketplace:** onboard local operators directly (Stripe Connect), sell time-boxed inventory tied to occurrences ("aurora chase, Feb 12–20"), take a lower commission than the aggregators while giving operators demand forecasting from our calendar. Needs operator dashboard, availability, payouts, disputes — deferred.

Design consequences now:
- Offers are first-class (`booking_offer`, many-to-many with phenomena via `offer_phenomenon`), with `provider` and `supplier` as tables so `'own'` is a row later, not a migration.
- Every affiliate click gets a first-party `click_id` embedded in the partner sub-ID, and partner reports are reconciled into a `conversion` table. Commissions confirm weeks–months after travel; without reconciliation, click logs cannot prove revenue per phenomenon/place.
- Money is integer minor units + ISO currency + `as_of`; never bare `numeric`.
- Landing pages must be crawlable and **have original per-pair editorial content** (schema-level, see `phenomenon_place`). Thin templated pages on a new domain will not index.
- Monetization is **not** a ranking term. **[decision]** EU UCPD Art. 7(4a) requires disclosing commission-influenced ranking; apply monetization as a disclosed tie-breaker/re-ranker only.
- Disclosure: affiliate relationship disclosed near the link on web and in-app (FTC 16 CFR 255); outbound links `rel="sponsored"`; redirect via `/go/{click_id}` on our own domain.

## 3. Core Domain Model

Separate the **timeless definition** of a thing from its **concrete dated windows**.

```
Phenomenon              timeless definition ("Monarch migration through central Mexico")
  ├── PhenomenonPlace   editorial layer per (phenomenon × place): how/where/ethics/FAQ — what Google ranks
  └── Rule(s)           versioned: how to compute windows (fixed, rrule, seasonal-band, lunar, astronomical, explicit, override)
        └── Occurrence  materialized window for one season at one place / area / globally: during, peak, confidence, geom
Place                   point, park, city, region, country — PostGIS geometry + hierarchy (ltree) + timezone
Source                  provenance per phenomenon AND per rule (the window is what gets cited)
LandingPage             resolvable slug → page kind + entities; indexability, canonical, lastmod (SEO control plane)
Provider / Supplier     affiliate network or marketplace; operator behind an offer
BookingOffer            bookable tour/activity/stay tied to a Place, many-to-many with Phenomena
AffiliateClick → Conversion   first-party click id → partner-reported booking, status, commission
```

Occurrences have a **scope**: `place` (point-anchored, most rows), `area` (polygon — eclipse umbra path, aurora oval, meteor visibility band; one row, matched at query time), `global` (instants with no geometry — equinoxes, moon phases; a few hundred rows joined in). This is how astronomy avoids `places × events` row explosion.

### 3.1 Postgres schema (Supabase) — v2

Conventions: every catalog table has `created_at`, `updated_at` (trigger) and `status`; client-cached tables also get `deleted_at` (tombstones; never hard-delete published catalog rows). Time windows are half-open `tstzrange` named `during` (`window` is a reserved word). Money = `*_minor int` + `currency char(3)`. Extensions: `postgis`, `btree_gist`, `ltree`, `pg_cron`, `pg_net`.

```sql
create type family           as enum ('wildlife','astronomy','cultural','seasonal_nature','activity');
create type occurrence_scope as enum ('place','area','global');

-- ───────────── places ─────────────
create table place (
  id           uuid primary key,
  slug         text not null unique,
  name         text not null,
  kind         text not null check (kind in ('point','park','city','region','country')),
  geom         geography(geometry,4326) not null,
  centroid     geography(point,4326) generated always as (st_pointonsurface(geom::geometry)::geography) stored,
  bbox         geometry(polygon,4326)   generated always as (st_envelope(geom::geometry)) stored,
  country_code char(2), admin_code text,
  timezone     text not null,                          -- IANA
  elevation_m  int, geomag_lat numeric(5,2),           -- gradient + aurora rule inputs, precomputed
  parent_id    uuid references place(id),
  path         ltree,                                  -- ancestry for breadcrumbs/URLs (roll-ups are spatial, not hierarchical)
  description_md text, hero_image_id uuid,
  status       text not null default 'published' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index place_geom_gist on place using gist (geom);
create index place_path_gist on place using gist (path);

-- ───────────── phenomena ─────────────
create table phenomenon (
  id uuid primary key, slug text not null unique, name text not null,
  family family not null, tags text[] not null default '{}',
  summary text, description_md text,                   -- default-language columns; translations → phenomenon_i18n later
  practical jsonb,
  spectacle smallint check (spectacle between 1 and 5),  -- editorial rarity/spectacle prior for ranking
  rarity    smallint,                                    -- derived from cadence
  feasibility jsonb,                                     -- needs_dark_sky, needs_boat, permit_required, ...
  status text not null default 'draft' check (status in ('draft','published','archived')),
  contributed_by uuid, moderated_by uuid, published_at timestamptz,
  search tsvector generated always as (to_tsvector('simple', name || ' ' || coalesce(summary,''))) stored,  -- tags matched via GIN below (array_to_string is not immutable)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create index phenomenon_search_gin on phenomenon using gin (search);
create index phenomenon_tags_gin   on phenomenon using gin (tags);

-- editorial layer: the content that makes a landing page indexable
create table phenomenon_place (
  phenomenon_id uuid references phenomenon(id) on delete cascade,
  place_id      uuid references place(id) on delete cascade,
  description_md text, how_to_see_md text, best_vantage_md text, ethics_md text, faq jsonb,
  hero_image_id uuid, editor_id uuid, reviewed_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (phenomenon_id, place_id)
);

-- ───────────── rules & materialization ─────────────
create table source (
  id uuid primary key, url text, title text, publisher text, license text, terms_url text,
  commercial_ok bool, last_verified date, accessed_at date, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table phenomenon_source (phenomenon_id uuid references phenomenon(id), source_id uuid references source(id), primary key (phenomenon_id, source_id));

create table rule (
  id            uuid primary key,
  phenomenon_id uuid not null references phenomenon(id) on delete cascade,
  place_id      uuid references place(id),             -- null for area/global rules
  scope         occurrence_scope not null default 'place',
  kind          text not null check (kind in ('fixed_annual','rrule','seasonal_band','lunar','astronomical','explicit','cadence','override')),
  params        jsonb not null,                        -- shape per kind, validated by zod in packages/domain
  confidence    numeric(3,2) not null check (confidence between 0 and 1),
  version       int not null default 1,                -- bumped by trigger on any params change
  active        bool not null default true,
  source_id     uuid references source(id),            -- the window itself needs a citation
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index rule_phenomenon on rule (phenomenon_id);
create index rule_place      on rule (place_id);

create table rule_materialization (                    -- what was produced → incremental, idempotent nightly runs
  rule_id uuid references rule(id) on delete cascade, season_year int not null,
  rule_version int not null, engine_version text not null, inputs_hash text not null,
  row_count int not null, materialized_at timestamptz not null default now(),
  primary key (rule_id, season_year)
);

create table occurrence (
  id            uuid primary key,                      -- uuid v5 of (rule_id, season_key, place_id): stable across regenerations
  rule_id       uuid not null references rule(id) on delete cascade,
  phenomenon_id uuid not null references phenomenon(id) on delete cascade,
  place_id      uuid references place(id),             -- null when scope = 'global'
  scope         occurrence_scope not null default 'place',
  season_key    text not null,                         -- assigned by rule kind: '2026', '2026-27', '2030-2' (2nd Ramadan), '2026-08-12' (eclipse)
  family        family not null,
  tags          text[] not null default '{}',          -- denormalized for interest matching without a join
  during        tstzrange not null,                    -- [start, end)
  peak          tstzrange,                             -- ⊆ during
  granularity   text not null check (granularity in ('day','instant')),
  confidence    numeric(3,2) not null check (confidence between 0 and 1),
  geom          geography(geometry,4326),              -- point (place) | polygon (area) | null (global)
  status        text not null default 'published' check (status in ('draft','published','archived')),
  rule_version  int not null, engine_version text not null,
  generated_at  timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint occ_during_halfopen  check (lower_inc(during) and not upper_inc(during) and not isempty(during)),
  constraint occ_peak_in_during   check (peak is null or peak <@ during),
  constraint occ_global_no_geom   check ((scope = 'global') = (geom is null)),
  constraint occ_place_has_place  check (scope <> 'place' or place_id is not null),
  constraint occ_rule_place_season unique nulls not distinct (rule_id, place_id, season_key),
  constraint occ_no_overlap exclude using gist
    (rule_id with =, coalesce(place_id,'00000000-0000-0000-0000-000000000000'::uuid) with =, during with &&)
);
create index occ_geom_during_gist on occurrence using gist (geom, during) where status = 'published' and scope <> 'global';
create index occ_global_during    on occurrence using gist (during) where scope = 'global';
create index occ_phenomenon       on occurrence (phenomenon_id, lower(during));
create index occ_place_during     on occurrence (place_id, lower(during));
create index occ_updated_at       on occurrence (updated_at);
create index occ_tags_gin         on occurrence using gin (tags);

-- ───────────── SEO control plane ─────────────
create table landing_page (
  id uuid primary key, slug text not null unique,
  kind text not null check (kind in ('phenomenon','place','place_month','pair','event','family','calendar_month')),
  phenomenon_id uuid references phenomenon(id), place_id uuid references place(id),
  month smallint, event_occurrence_id uuid references occurrence(id) on delete set null,
  indexable bool not null default false, canonical_slug text, title text, meta_description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table slug_redirect (old_slug text primary key, entity text not null, entity_id uuid not null, new_slug text not null, created_at timestamptz default now());

-- ───────────── commerce ─────────────
create table provider (
  id text primary key,                                 -- 'viator' | 'gyg' | 'booking' | 'own'
  kind text not null check (kind in ('affiliate','marketplace')),
  tracking_template text, attribution_window_days int, commission_pct numeric, terms_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table supplier (
  id uuid primary key, provider_id text references provider(id), external_id text, name text, place_id uuid references place(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (provider_id, external_id)
);
create table place_external_ref (                      -- Viator/GYG destination ids ↔ our places
  place_id uuid references place(id), provider_id text references provider(id), external_id text, kind text,
  primary key (provider_id, external_id)
);
create table booking_offer (
  id uuid primary key, provider_id text not null references provider(id), supplier_id uuid references supplier(id),
  external_id text, title text, kind text check (kind in ('tour','activity','stay')),
  place_id uuid references place(id),
  price_from_minor int, currency char(3), price_as_of timestamptz,
  rating numeric(2,1), review_count int, duration_minutes int, image_url text, cancellation_policy text,
  url text, deep_link_params jsonb,
  valid tstzrange,                                     -- operator season
  active bool not null default true, last_seen_in_feed_at timestamptz, provider_payload jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (provider_id, external_id)
);
create index booking_offer_place on booking_offer (place_id) where active;
create table offer_phenomenon (offer_id uuid references booking_offer(id) on delete cascade, phenomenon_id uuid references phenomenon(id), primary key (offer_id, phenomenon_id));
create table offer_availability (offer_id uuid references booking_offer(id) on delete cascade, during tstzrange not null, capacity int, price_minor int, currency char(3));  -- marketplace; empty until Phase B

create table affiliate_click (
  id bigint generated always as identity primary key,
  click_id text not null unique,                       -- short, non-sequential; embedded in partner sub-id
  clicked_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  anon_id uuid, session_id text,                       -- ~95% of clicks are anonymous
  offer_id uuid not null references booking_offer(id), provider_id text references provider(id),
  occurrence_id uuid references occurrence(id) on delete set null,
  phenomenon_id uuid, place_id uuid, landing_page_id uuid,   -- denormalized so analytics survive occurrence churn
  surface text, device text, country char(2), referrer text, variant text, ua_hash text, ip_hash text, context jsonb
);
create index affiliate_click_time on affiliate_click (clicked_at);
create table conversion (
  id uuid primary key, click_id text references affiliate_click(click_id), provider_id text references provider(id),
  provider_booking_ref text, status text check (status in ('pending','confirmed','cancelled','paid')),
  gross_minor int, commission_minor int, currency char(3),
  booked_at timestamptz, travel_date date, paid_at timestamptz, imported_at timestamptz default now(), raw jsonb,
  unique (provider_id, provider_booking_ref)
);
create table booking (                                 -- one funnel for affiliate (from conversion) and marketplace (from Stripe)
  id uuid primary key, user_id uuid, offer_id uuid references booking_offer(id), occurrence_id uuid,
  provider_id text references provider(id), status text, gross_minor int, currency char(3), commission_minor int, click_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table fx_rate (base char(3), quote char(3), rate numeric not null, as_of date not null, primary key (base, quote, as_of));

-- ───────────── users ─────────────
create table profile (user_id uuid primary key references auth.users(id) on delete cascade, interests family[], units text, home_place_id uuid references place(id), locale text, currency char(3), updated_at timestamptz not null default now());
create table device (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, expo_push_token text unique, platform text, last_seen_at timestamptz, coarse_geom geography(point,4326), locale text);
create table trip (id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade, name text, share_token text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table trip_leg (id uuid primary key, trip_id uuid not null references trip(id) on delete cascade, place_id uuid references place(id), dates daterange not null, position int, updated_at timestamptz not null default now());
create table trip_item (id uuid primary key, trip_id uuid not null references trip(id) on delete cascade, leg_id uuid references trip_leg(id) on delete cascade, occurrence_id uuid references occurrence(id) on delete set null, offer_id uuid references booking_offer(id), status text, position int, updated_at timestamptz not null default now());
create table save (user_id uuid not null references auth.users(id) on delete cascade, phenomenon_id uuid not null references phenomenon(id), place_id uuid references place(id), note text, remind_days_before int, updated_at timestamptz not null default now(), primary key (user_id, phenomenon_id, place_id));
create table alert (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, kind text, params jsonb, active bool default true, updated_at timestamptz not null default now());
create table contribution (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, type text, payload jsonb, status text default 'pending', created_at timestamptz default now());
create table report (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  phenomenon_id uuid not null references phenomenon(id), place_id uuid references place(id),
  occurrence_id uuid references occurrence(id) on delete set null,       -- convenience, not identity
  seen_at date not null, rating int check (rating between 1 and 5), note text, photo_path text,
  geom geography(point,4326), created_at timestamptz not null default now()
);
create index report_phen_seen on report (phenomenon_id, seen_at);     -- tunes seasonal_band variance

-- ───────────── ops / analytics ─────────────
create table config (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table event (id bigint generated always as identity primary key, ts timestamptz not null default now(), session_id text, user_id uuid, name text not null, props jsonb);  -- impressions → clicks → conversions funnel
```

**Core query** — exposed only as an RPC (`explore(lat, lng, radius_m, from_ts, to_ts, families, interests)` returning flat typed rows; PostgREST serialises `geography`/ranges poorly and direct `select` on `occurrence` is revoked for `anon`). `st_dwithin` on a polygon is true when the point is inside it, so one predicate serves point- and area-scoped rows; global rows are `union all`-ed in from the tiny partial index:

```sql
with here as (select st_setsrid(st_makepoint(:lng,:lat),4326)::geography g),
cand as (
  select o.*, st_distance(o.geom, here.g, false) as dist_m from occurrence o, here
  where o.status = 'published' and o.scope <> 'global'
    and st_dwithin(o.geom, here.g, :radius_m)
    and o.during && tstzrange(:from, :to)
    and (:families is null or o.family = any(:families))
  union all
  select o.*, 0 from occurrence o
  where o.scope = 'global' and o.status = 'published' and o.during && tstzrange(:from, :to)
    and (:families is null or o.family = any(:families))
  limit 2000
)
select c.*, rank_score(c.during, c.peak, c.confidence, c.dist_m, :radius_m, :from, c.tags, :interests) as score
from cand c order by score desc limit 50;
```

Benchmarked by the data reviewer at 1M synthetic rows: the composite `(geom, during)` GiST answers Explore (200 km × 14 d) in ~6 ms and Plan (500 km × 90 d) in ~5 ms vs 20–48 ms with separate indexes. Pagination: Explore returns 50–100 and pages client-side (score depends on `now` + GPS); time-ordered surfaces use keyset on `(lower(during), id)`; map returns geohash-cell aggregates when zoomed out.

**RLS boundaries.** Catalog tables: `select using (status='published')`, writes via `service_role`/admin role; drafts through `admin_*` views. User tables: `using ((select auth.uid()) = user_id)` with every `user_id` indexed. `affiliate_click`: insert for `anon`+`authenticated`, no client `select`. Shared trips: `security definer` RPC `get_shared_trip(token)`, not RLS.

### 3.2 Rules

```ts
type Rule =
  | { kind: 'fixed_annual';  startMonthDay: string; endMonthDay: string; peakMonthDay?: string }                     // end < start rolls into next year (southern summer); season_key = year of start
  | { kind: 'rrule';         rrule: string; durationDays: number }                                                 // RFC 5545 in place tz: "every Saturday Jun–Aug", "4th Thursday of Nov"
  | { kind: 'seasonal_band'; peakDoy: number; halfWidthDays: number; peakSigmaDays: number; hemisphere: 'N'|'S';
                             gradient?: { anchor: { lat: number; elevM: number }; daysPerDegLat: number; daysPer100mElev: number };
                             driver?: 'photoperiod'|'temperature'|'snowmelt'|'rainfall'|'sst'|'unknown' }           // one region rule → per-place shifted windows (blossom front, foliage front)
  | { kind: 'lunar';         calendar: 'hebrew'|'easter_western'|'easter_orthodox'|'chinese'|'hijri_umm_al_qura'; offsetDays: number; durationDays: number }  // Hindu/regional observances → explicit windows from a sourced table
  | { kind: 'astronomical';  table: 'eclipse'|'meteor'|'moon_phase'|'equinox'|'tide'|'aurora_season'; filter: Record<string, unknown> }
  | { kind: 'explicit';      windows: { seasonKey: string; start: string; peak?: [string,string]; end: string }[] }  // curated + one-offs (Olympics, Kumbh Mela)
  | { kind: 'cadence';       everyNYears: number; anchorYear: number; startMonthDay: string; endMonthDay: string }
  | { kind: 'override';      placeId: string; seasonKey: string; start: string; peak?: [string,string]; end: string; reason: string };  // admin correction; highest precedence; survives regeneration
```

`materialize(rule, place, seasonYear, inputs) → Occurrence[]` is a pure, versioned function in `packages/domain`, but it **runs server-side only** (nightly Node job or plpgsql). Clients never see rules — they download occurrences. What clients share from `packages/domain` is `rankScore`, `peakProximity` (defined explicitly: 1 inside peak, linear to 0 at window edge, exponential beyond), date/timezone formatting and zod types. Contract: same `(rule.version, engine_version, inputs_hash)` ⇒ byte-identical rows; golden-file tests per kind for 2025–2027 fail CI on unversioned output changes. Local civil dates are converted with the **place's** timezone; `seasonal_band` never auto-flips hemispheres (engine rejects a N-rule on a S-place). Report histograms tune `peakDoy/peakSigmaDays` via a moderated proposal that bumps `rule.version` — never a live write.

Astronomy emits by scope: eclipses → `area` rows for umbra (conf 1.0) and penumbra (0.8) polygons, plus `place` rows for ≤50 curated eclipse destinations (so SEO pages exist); meteor showers → one `area` lat-band polygon (split into 4 longitude quadrants), confidence scaled by moon illumination at peak; aurora → `place` rows where `place.geomag_lat ≥ threshold` in season; moon phases/equinoxes → `global` instants ("dark-sky new moon at this park" is a query-time join with `tags @> '{dark_sky}'`). All computed with `astronomy-engine` (pure JS, deterministic) from content-addressed `data/tables/*.json`.

## 4. Architecture

### 4.1 TypeScript monorepo — Next.js + Expo + Supabase (confirmed by both reviewers)

Chosen because **global catalog + Plan on web + affiliate revenue** make organic search the acquisition channel: "when to see [phenomenon] in [place]" pages must be server-rendered. Flutter web renders to canvas (HTML renderer deprecated) — a category risk, not an execution risk. Postgres/PostGIS over Firestore is decisive and independent of the UI framework (geo ∩ range ∩ facets with server-side ranking in one indexed statement; relational catalog). Supabase over Neon/RDS+API or Hasura for a small team: PostGIS, `btree_gist`, `pg_cron`, `pg_net`, RLS, Auth, Storage in one project; migrations stay plain SQL and portable.

The mobile choice is **reversible at low cost**: because `materialize()` is server-side, a Flutter client would only re-implement ranking/formatting and use Supabase's generated Dart types. RN is recommended on team-size grounds (one language, one zod schema set, shared URL semantics for universal links). If Flutter velocity proves >2× RN, the hybrid is not wrong.

```
┌────────────── apps/web (Next.js, App Router) ──────────────┐   ┌──────── apps/mobile (Expo / React Native) ────────┐
│ SSG/ISR landing pages (plain React + Tailwind, semantic    │   │ Explore (GPS, next-N-days), Map, Trip, Detail,    │
│ HTML) resolved via landing_page; Plan, Trip, Calendar,     │   │ offline bundles (expo-sqlite) + outbox, push      │
│ Contribute, Admin; /go/[click_id] affiliate redirect       │   │ Expo Router, EAS dev client, @rnmapbox or MapLibre│
└─────────────────────────────┬───────────────────────────────┘   └───────────────────────┬──────────────────────────┘
                              │   packages/domain  (zod models, rankScore/peakProximity, formatting; materialize() for server + tests)
                              │   packages/api     (typed Supabase client, RPC wrappers, TanStack Query hooks)
                              │   packages/tokens  (colors/spacing/icons as JSON — NOT shared UI primitives for SEO pages)
                              ▼
┌──────────────────────────── Supabase ─────────────────────────────┐   ┌──── jobs/ (Node worker; GitHub Actions cron / Fly) ────┐
│ Postgres + PostGIS + btree_gist + ltree (source of truth)          │   │ materialize (incremental via rule_materialization)     │
│ RPCs: explore(), plan(), map_cells(), get_shared_trip()            │◄──│ ingest/* (astronomy tables, Wikidata, eBird, offers)   │
│ Auth (anon, magic link, Apple/Google) · Storage (media, bundles)   │   │ bundles → Storage · conversion import (partner CSV/API)│
│ pg_cron: evaluate_alerts, vacuum after materialize                 │   │ then pg_net → Vercel revalidateTag + IndexNow ping     │
│ Edge Functions: request-path webhooks only                         │   └────────────────────────────────────────────────────────┘
│ RLS: catalog public-read where published; user rows by auth.uid()  │
└────────────────────────────────────────────────────────────────────┘
Hosting: Vercel Pro (web) · EAS (mobile builds/OTA) · Supabase Pro (never free tier in prod) · Supavisor pooler / PostgREST from serverless
```

Amendments from review (all adopted): batch jobs run as Node importing `packages/domain` directly (Edge Functions are Deno with tight wall-clock limits; workspace imports don't work cleanly); the affiliate redirect lives in a Next.js route handler on our domain (no cross-origin hop; Safari ITP punishes bounce-tracking domains), HMAC-signed and deduped per `(anon_id, offer_id, day)`; SEO pages do not use Tamagui/RN-web primitives — they need `<article>/<h1>/<table>/<time>`; Tamagui reconsidered only for in-app screens shared across web+mobile (Plan, Trip).

### 4.2 Maps **[decision]**
`react-native-maps` has no web build and no offline tile packs. Pick one vector-tile vendor for both platforms: **Mapbox** (`@rnmapbox/maps` + Mapbox GL JS; paid, polished, offline packs) or **MapLibre** (OSS, more assembly). Either needs an EAS dev client (not Expo Go). Server-side clustering (`map_cells()` geohash aggregates) for the time scrubber; static map images on landing pages (Core Web Vitals).

### 4.3 Offline & sync
Catalog is read-only and shared; user data is per-user and tiny — so no PowerSync/Watermelon in v1.
- **Bundles**: unit = `(geohash-3 cell, calendar quarter)`, gzipped JSON in Storage at `bundles/{catalog_version}/{cell}/{quarter}.json.gz` + `manifest.json`; `global.json` always present; area polygons simplified ≤2 kB. A trip leg maps to 4–9 cells × 1–2 quarters. Client: `expo-sqlite` mirror, bbox prefilter in SQL, haversine + `rankScore` in JS. Media cached via `expo-file-system`, LRU-capped per trip.
- **User data**: local-first with an `outbox`; client-generated uuid PKs; replay on reconnect via idempotent upserts; LWW by `updated_at`.
- Background location is **not** required for v1 — daily push digest uses `device.coarse_geom`.

### 4.4 URLs, SEO and structured data

Routes resolve against `landing_page` (never parse `{phenomenon}-in-{place}` — slugs containing `-in-` break it). Evergreen URLs, no years except `/event/*`. `slug_redirect` → 301 in middleware.

| Route | Kind | Notes |
|---|---|---|
| `/p/{slug}` | phenomenon | the global "when & where to see X" hub: best places, 12-month band chart, next 3 dated occurrences |
| `/when-to-see/{phenomenon}-in-{place}` | pair | the money page; requires `phenomenon_place` editorial content |
| `/event/{slug}` | event | one-off dated astronomy (`total-solar-eclipse-2026-08-12`); the only legit `Event` markup outside cultural |
| `/place/{slug}` · `/place/{country}` · `/place/{region}` | place | hubs via `place.path`; `?from=&to=` canonicalises to the bare slug |
| `/place/{slug}/{month}` | place_month | generated **only** when ≥3 occurrences overlap that month; positioned as "what's happening", never a destination guide |
| `/calendar/{month}` · `/family/{family}` | hubs | keep every landing page ≤3 clicks from home |
| `/explore`, `/trip/{token}`, `/go/*`, `/admin` | — | `noindex`, disallowed in `robots.txt` |

**Publishing gate**: a pair page is `indexable` only with (i) ≥~300 words of original pair-specific text, (ii) ≥1 published occurrence in the next 24 months, (iii) ≥1 cited `source`. Everything else is `noindex` or not generated. Expect 1–3k indexable pages at launch — a small high-quality catalog, which is what ranks on a new domain (Google's scaled-content-abuse policy hit templated travel/affiliate sites hard in 2024).

**Rendering**: ISR `revalidate = 86400` + on-demand `revalidateTag('lp:<id>')` from the nightly job; `generateStaticParams` for the top ~500 pages, `dynamicParams` for the tail; absolute dates server-side (`<time datetime>`), relative phrasing client-side. Sitemaps sharded by page kind via `generateSitemaps`, `lastmod` from `landing_page.updated_at`, indexable pages only; IndexNow ping on revalidate.

**Structured data**: `Event` only for `family='cultural'` with fixed dates and for `/event/*` one-offs (seasons are not Events — marking them up invites a manual action). Always: `BreadcrumbList`, `Article` (author, `dateModified`, `citation`), `Place`/`geo`, `ImageObject` with license, `Organization`; `Dataset` for the annual peak-calendar export. No `Product`/`Offer` on affiliate cards; `TouristAttraction`/`Trip` are harmless but earn no SERP feature. Every pair page carries "sources & last verified" and a named editor (E-E-A-T).

**i18n [decision]**: English at root, locales path-prefixed (`/es/…`) when they come; `name/summary/description_md` are default-language columns, translations in `*_i18n` tables. Costs nothing now, avoids a URL migration later.

**Realistic expectation**: 6–12 months to meaningful organic traffic on a new domain. Link-earning assets from P2: embeddable SVG band chart per phenomenon, `.ics` feeds per phenomenon/place/trip, CC-BY "Global Peak Calendar" dataset.

## 5. Product Surface (v1)

| Screen | Purpose | Key interactions |
|--------|---------|------------------|
| **Explore (Home)** | "Near me, next 14 days" | three tiers, never empty: **Nearby now** → **Worth a detour** (≤300 km, 30 d) → **Coming up in this region** (90 d); family chips; explainable cards ("peak in 4 days · 45 min away · high confidence"); **Sky tonight** module for global-scope astronomy (capped 1–2 cards) **[decision]** |
| **Map** | spatial view of Occurrences | server-clustered pins, time scrubber re-queries bbox × range |
| **Plan** | destination + dates, or phenomenon-first | *"I'm going to ___ from ___ to ___"* and *"I want to see ___"* (works globally with no location — the empty-state-proof surface) |
| **Phenomenon detail** | everything about one thing | band chart, next 3 occurrences, places, tips, sources, save/alert, add to trip, **booking module** (rating, duration, photo, "from" price with freshness, disclosure) |
| **Pair landing** (web) | SEO money page | editorial + window + band chart + offers + "same phenomenon elsewhere / same place other months / nearby this month" |
| **Trip** | itinerary overlay | legs on a timeline, `trip_item`s per leg (occurrences + bookings); "shift dates" shows gain/loss |
| **Calendar** | year at a glance | 12-month heat strip per saved/interest family |
| **Contribute** | community data | propose phenomenon, correct a window (→ `override` rule), field report ("it's happening now") |
| **Admin** (web) | moderation + catalog editing | approve contributions, edit rules (bumps version), preview drafts, re-materialize |
| **Profile / Alerts** | `profile` interests, units, currency, notification prefs | |

Ranking (in SQL, on the candidate set, weights from `config`):
```
score = w1 * peakProximity(now, peak, during)   // 1 inside peak → 0 at window edge → exp decay
      + w2 * travelBand(dist_m × 1.4)            // great-circle × detour factor; isochrones later
      + w3 * confidence
      + w4 * cardinality(tags ∩ interests)
      + w5 * spectacle / rarity prior
      + feasibility gate (dark sky, boat, permit) · per-family diversity cap
// monetization is NOT in the score — disclosed re-ranker/tie-breaker only [decision]
```
Ranking features are logged with impressions (`event`) so weights can be tuned offline.

## 6. Data Strategy (the hard part)

Quality of the catalog *is* the product. Global-but-thin means breadth first, depth via automation and community:

1. **Seed catalog (~300 phenomena)** across all five families, hand-written rules, every rule with a `source`. Seed **where travelers physically are [decision]**: top 50 destinations by visitor volume + top 20 US national parks + top 10 safari/whale/aurora circuits (rather than top 50 countries) — the single biggest lever on the empty-state risk after the geometry fix.
2. **Editorial layer**: 300–500 words per indexable `phenomenon_place` pair (LLM-drafted, human-reviewed, named editor). This is the SEO plan's binding constraint — see founder question 1.
3. **Ingest pipelines** (Node jobs, idempotent, content-addressed inputs): astronomy (NASA eclipse paths, IMO calendar, `astronomy-engine`); cultural (Wikidata festivals, holiday tables for moveable feasts); wildlife/nature (expert `seasonal_band` rules with gradients, later fitted from eBird/GBIF/iNaturalist histograms — check commercial terms per source); activities (operator seasons from affiliate catalogs — verify derived-data reuse is permitted by API terms).
4. **Ground-truth loop**: `report(phenomenon, place, seen_at)` histograms → moderated rule proposals → version bump → regeneration.
5. **Licensing**: `source.license`, `terms_url`, `commercial_ok`; CC-BY/CC0/own media only; original text. `supabase/seed/*.yaml` stays the human-editable source of truth so the DB is reproducible from Git **[decision: Git vs Admin as rule source of truth]**.

## 7. MVP Scope & Roadmap

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| **P0 — Skeleton** | Turborepo: `apps/web`, `apps/mobile`, `packages/{domain,api,tokens}`, `jobs/`; Supabase project + **v2 migrations above** (all tables, including empty commerce/marketplace ones); RLS; RPC `explore()`; auth (anon + magic link); `materialize()` for `fixed_annual`/`rrule`/`explicit`/`astronomical(global)` with golden tests; CI (typecheck, lint, test, `supabase db lint`) | 1 session |
| **P1 — Catalog + Explore + Detail** | seed ~100 phenomena + destination-first places, Explore (web + mobile, three tiers), detail with band chart, Map with scrubber, first affiliate module (deep links + `/go/{click_id}`, `event` impressions), apply to Viator/GYG/Booking | 1–2 sessions |
| **P2 — Plan + Trips + SEO** | Plan, Trip + `trip_item` + share RPC, Calendar, `seasonal_band` (with gradients) + `lunar`, `landing_page`-driven ISR pages with publishing gate, sitemaps, IndexNow, `.ics` | 1–2 sessions |
| **P3 — Community + Alerts + Offline** | Contribute + Admin (override rules), reports → moderated tuning, push/email digests, bundles + outbox | 1–2 sessions |
| **P4 — Growth** | ingest pipelines, `conversion` import from partner reports, lodging affiliate, embeddable band chart, dataset export, analytics funnel | 1–2 sessions |
| **P5 — Marketplace** | operator onboarding (`supplier` → Stripe Connect), `offer_availability`, `booking` from webhooks, payouts | 2–3 sessions |

External waits: Apple/Google developer accounts; Supabase Pro + Vercel Pro + EAS; affiliate approvals (apply in P0 — deep-links-only tiers change what P1 can ship); maps vendor account; data-source API keys.

## 8. Risks & Open Questions

- **Empty state** is the biggest product risk: mitigated by area/global scope + geometry (not centroid) matching, destination-first seeding, three-tier Explore, and phenomenon-first Plan.
- **Editorial capacity** gates SEO: no per-pair text → no indexable pages, regardless of architecture.
- **Attribution loss**: expect 30–60% of mobile (iOS/ITP) clicks un-attributable and revenue proof lagging 1–4 months; first-party `click_id` in partner sub-IDs + `conversion` import is the source of truth, not cookies.
- **Phenology variance**: peak ± sigma bands, hemisphere-explicit rules, report loop; never a single date for `seasonal_band`.
- **Confidence semantics [decision]**: "how sure are we of the dates" (what the report loop tunes) vs "how likely you'll see it" (what users read). Decide before UI copy.
- **Operational**: nightly regeneration must be incremental (`is distinct from` upserts) or GiST bloat/autovacuum dominates; `vacuum analyze occurrence` after each run; PITR before seed work is irreplaceable; `alter table occurrence` locks reads for minutes at 1M rows — get it right now.
- **Name**: "Serendipity" is crowded on app stores/domains — check early (alternatives: *Whenabouts*, *Peakfinder*, *Tidewatch*).

## 9. Repo Layout

```
serendipity/
├── apps/
│   ├── web/                # Next.js (App Router): landing pages, Plan, Trip, Admin, /go redirect
│   └── mobile/             # Expo (Expo Router): Explore, Map, Trip, Detail, offline
├── packages/
│   ├── domain/             # zod models, rankScore/peakProximity, formatting, materialize() (server + tests), golden fixtures
│   ├── api/                # Supabase client, RPC wrappers, TanStack Query hooks
│   └── tokens/             # design tokens + icons (JSON); no shared UI primitives for SEO pages
├── jobs/                   # Node workers: materialize, ingest/*, bundles, conversion import, revalidate
├── supabase/
│   ├── migrations/         # v2 schema above (plain SQL; portable)
│   ├── functions/          # edge functions: request-path webhooks only
│   └── seed/               # phenomena.yaml, places.yaml, rules.yaml, sources.yaml
├── data/tables/            # eclipses.json, meteor_showers.json, holidays.json (content-addressed)
├── docs/                   # this file, ADRs, reviews/
└── .github/workflows/      # typecheck + lint + test + supabase db lint + nightly materialize
```
