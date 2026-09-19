# Serendipity — Independent Data-Architecture Review of `docs/DESIGN.md`

Reviewer lens: data model, query performance, correctness, operations (PostGIS / temporal indexing / Supabase / offline mobile).
Scope: `docs/DESIGN.md` @ `main` (commit `10b7bab`). Review-only; no repository changes.

Evidence labels used below: **[measured]** = I ran it (PostGIS 3.4 on Postgres 16, Docker, 1 M synthetic occurrence rows, 20 k places clustered around 400 hotspots, 3-year horizon, ~37-day average windows); **[docs]** = from vendor documentation as I know it — verify before relying on numbers; **[est]** = my estimate/inference.

---

## 1. Verdict: **confirm-with-changes**

The shape of the design is right: timeless `Phenomenon` → versionable `Rule` → materialized `Occurrence`, queried with `geo ∩ time-range ∩ facets` in one indexed statement on Postgres/PostGIS. That is the correct data model for this product, and Firestore is genuinely a poor fit for the core query (details §5). Supabase is a sound way to run it.

But the §3.1 DDL is not ready to lock. As written it **does not even execute** (`window` is a reserved word — **[measured]**, 4 errors when running the §3.1 block verbatim), and a handful of decisions will force a painful migration if they ship in Phase 0:

1. `occurrence.id = "{phenomenon_id}_{place_id}_{year}"` is not a valid key for this domain (multiple windows per year; seasons spanning New Year; no `rule_id`, so occurrences cannot be regenerated or attributed).
2. Occurrences are anchored to a point `centroid` only. Astronomy (meteor showers, supermoons, new-moon dark skies, aurora bands, eclipse paths), moveable feasts (Ramadan, Easter) and other area/global phenomena either explode into one row per place or cannot be represented. This is the biggest modelling gap.
3. No `created_at`/`updated_at`/tombstones anywhere in the catalog — offline sync, ISR revalidation and "what changed" all depend on them.
4. `report` and `affiliate_click` reference `occurrence.id text`, a row that is rewritten nightly.
5. Publishing status and RLS are on `phenomenon` but not on `occurrence`, which is the table the public actually queries.
6. Two separate GiST indexes instead of one composite `(geom, window)` GiST — **[measured]** 3–10× more buffer reads and 3–10× slower at 1 M rows.

None of these is hard to fix now. All of them are painful after seed data, deep links and cached bundles exist. Land §3 below before Phase 0.

---

## 2. Stack decision

### 2.1 Postgres/PostGIS vs Firestore — **confirm, strongly**

The core query is `ST_DWithin(point, radius) AND window && [from,to) AND family IN (...) ORDER BY score LIMIT 50`, plus facet counts, plus relational joins (phenomenon ↔ place ↔ source ↔ offer). On Firestore:

- Geo radius requires the geohash-prefix trick (GeoFire-style): N range queries on a geohash string, over-fetching the bounding box and filtering false positives on the client **[docs]**.
- Interval overlap is `start <= to AND end >= from`: two inequalities on two fields. Firestore has supported multiple-inequality queries since 2024 **[docs]**, but combining them with the geohash range makes three inequality fields plus an `in` on `family` — each combination needs its own composite index, ordering is constrained to the inequality fields, and you still pay one document read per candidate (not per result).
- Ranking by a computed score (`peakProximity × distance × confidence × interest`) cannot be expressed server-side at all; you read the whole candidate set to the client every time.
- Facet counts (`count()` aggregation) exist but are billed per index entry scanned **[docs]**.
- Nightly rematerialization of ~1 M documents ≈ 1 M writes/night ≈ $1.8/night at list price **[docs, est]** — affordable, but it's paying for the wrong thing.

Verdict on the design's claim (b) "Firestore cannot express geo × date range × facets without a third-party index": essentially correct. It is *technically* expressible today with multi-inequality queries, but not efficiently, not with server-side ranking, and not without an index per facet combination. Typesense/Algolia (which do have geo + numeric range + facets natively) would be the realistic Firebase path — a second system to keep in sync with Firestore for the one query that *is* the product. Claim (c) (relational catalog) is correct. Claim (a) (Flutter web SEO) is correct — Flutter web renders to canvas (CanvasKit) and the HTML renderer is deprecated **[docs]**.

### 2.2 Supabase vs Neon/RDS + thin API vs Hasura/PostgREST — **confirm Supabase, with three operational rules**

Supabase gives you PostGIS, `btree_gist`, `pg_cron`, `pg_net`, RLS, Auth, Storage and PostgREST in one project. For a small team that beats Neon (no auth/storage/cron — you add Clerk, S3, a Hono/Fastify API and a scheduler) and beats Hasura (GraphQL layer you don't need; RLS-equivalent permissions duplicated in Hasura metadata). Nothing in the design is Supabase-proprietary except `auth.users` FKs; migrations remain plain SQL and portable to RDS/Neon later.

Rules that must be followed to avoid known pain:

1. **Do not expose `occurrence`/`place` raw through PostgREST for the core query.** PostgREST returns `geography` as hex EWKB by default and range types as text (`["2026-06-01 00:00:00+00","2026-06-15 00:00:00+00")`) **[docs]**. Wrap the core query in a `security invoker` SQL function `explore(lat, lng, radius_m, from_ts, to_ts, families family[], interests text[])` returning a flat, typed row (`starts_at`, `ends_at`, `peak_starts_at`, `lat`, `lng`, `dist_m`, `score`, …) and call it via `rpc()`. Same for Plan and the map endpoint. This also lets ranking stay in SQL (§4).
2. **Connection discipline.** Next.js on Vercel is serverless; use `supabase-js` over HTTP (PostgREST, no pooled connection) or the Supavisor transaction pooler (port 6543) — never direct Postgres from route handlers. Supabase compute tiers have small direct-connection limits (on the order of 60 direct / 200 pooled on the smallest Pro compute **[docs — verify current numbers]**).
3. **Don't run the nightly materializer in an Edge Function.** Edge Functions have wall-clock limits (150 s free / 400 s paid **[docs — verify]**) and 1 M row regeneration won't fit reliably. Options, in order of preference: (a) plpgsql `materialize_rule(rule_id, year)` called from `pg_cron`, with the pure-TS `materialize()` reserved for tests and admin preview, or (b) a Node job (uses `packages/domain`) on GitHub Actions cron / Fly Machine / Trigger.dev, connecting through the pooler, processing rules in batches. Use `pg_cron` for `evaluate_alerts` and `pg_net` to poke `revalidateTag` on Vercel after a run.

Cost **[docs, est]**: Pro $25/mo + smallest compute is enough through P3. 1 M occurrences with the indexes recommended below ≈ 0.5–0.7 GB **[measured 498 MB heap+indexes with the design's indexes; the text PK alone was 139 MB]**; well within the 8 GB included disk. Do not run production on the free tier (project pauses after inactivity **[docs]**).

### 2.3 Next.js + Expo vs Flutter + Firebase — confirm, but narrow the argument

The database decision is decisive and independent of the UI framework. The mobile framework decision is *not* forced by the data layer:

- The design's "share `materialize()` across web, mobile and the nightly job" rationale is weaker than it looks. Clients should **never** materialize rules: they need occurrences (downloaded), not rules. What clients genuinely share is ranking (`rankScore`), date/timezone formatting, zod types and the API client — small enough that a Dart mirror would be a maintenance annoyance, not a blocker.
- Therefore the "Flutter mobile + Next.js web, both on Supabase" alternative is more viable than §4.1 states — its real cost is two UI codebases and two typed clients (Supabase generates types for both TS and Dart), not a duplicated rule engine.

My recommendation stands with the design (TS monorepo) on team-size grounds: one language, one set of zod schemas, Expo Router + Next.js share URL semantics for universal links, and EAS OTA. But state the trade honestly in the ADR, and keep `materialize()` server-side so the choice remains reversible. If the team's Flutter velocity is >2× its RN velocity, the alternative is not wrong.

---

## 3. Schema changes required before Phase 0 (DDL diffs)

Applied against §3.1. Each item states *why now*.

### 3.0 It doesn't compile — rename `window`

`window` is a reserved keyword in PostgreSQL **[measured: `syntax error at or near "window"` on both the column and the index]**. Rename rather than quote (quoting infects every query, PostgREST filter and generated type):

```sql
-  window tstzrange not null,
-  peak   tstzrange,
+  during tstzrange not null,          -- half-open [start, end)
+  peak   tstzrange,                   -- must be contained in "during"
```

(Below I use `during`; pick any non-reserved name and keep it everywhere.)

### 3.1 `occurrence`: key, provenance, scope, status, sync columns

```sql
create extension if not exists btree_gist;
create extension if not exists postgis;

create type occurrence_scope as enum ('place','area','global');

create table occurrence (
  id            uuid primary key,                    -- uuid v5 of (rule_id, season_key, place_id) computed by the engine → stable across regenerations
  rule_id       uuid not null references rule(id) on delete cascade,
  phenomenon_id uuid not null references phenomenon(id) on delete cascade,
  place_id      uuid references place(id),           -- null when scope = 'global'
  scope         occurrence_scope not null default 'place',
  season_key    text not null,                       -- e.g. '2026', '2026-2', '2026-11-08' — assigned by the rule kind, NOT the calendar year of start
  family        family not null,
  tags          text[] not null default '{}',
  during        tstzrange not null,
  peak          tstzrange,
  granularity   text not null check (granularity in ('day','instant')),
  confidence    numeric(3,2) not null check (confidence between 0 and 1),
  geom          geography(geometry,4326),            -- point for 'place'; polygon/multipolygon for 'area'; null for 'global'
  status        text not null default 'published' check (status in ('draft','published','archived')),
  rule_version  int  not null,
  engine_version text not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- integrity
  constraint occ_during_halfopen check (lower_inc(during) and not upper_inc(during) and not isempty(during)),
  constraint occ_peak_in_during  check (peak is null or peak <@ during),
  constraint occ_global_no_geom  check ((scope = 'global') = (geom is null)),
  constraint occ_place_has_place check (scope <> 'place' or place_id is not null),
  constraint occ_rule_place_season unique nulls not distinct (rule_id, place_id, season_key),   -- PG15+; plain unique would not catch duplicate area/global rows (null place_id)
  -- catches materializer bugs: the same rule may not emit overlapping windows for the same place
  constraint occ_no_overlap exclude using gist (rule_id with =, coalesce(place_id, '00000000-0000-0000-0000-000000000000'::uuid) with =, during with &&)
);

-- THE index for the core query (see §5 for measurements)
create index occ_geom_during_gist on occurrence using gist (geom, during) where status = 'published' and scope <> 'global';
create index occ_global_during     on occurrence using gist (during) where scope = 'global';
create index occ_phenomenon        on occurrence (phenomenon_id, lower(during));
create index occ_place_during      on occurrence (place_id, lower(during));
create index occ_updated_at        on occurrence (updated_at);            -- delta sync
create index occ_tags_gin          on occurrence using gin (tags);       -- interest match
```

Why each:

- **`id` as deterministic `uuid` v5, not `text`.** Deterministic is right (regeneration must preserve ids so `report`, `affiliate_click`, deep links and cached bundles survive). But `text` of 78 chars costs **[measured]** 139 MB of PK index at 1 M rows vs ~30 MB for uuid, and the `{year}` component is wrong: lunar/tidal/moon-phase rules emit several windows per Gregorian year (Ramadan starts twice in 2030; supermoons 3–4×/yr; king tides several/yr; new-moon dark skies 12–13×/yr), and southern-hemisphere seasons span New Year (Dec–Feb ski season is "2026-27"). `season_key` is chosen by the rule kind and documented per kind (fixed/seasonal: year of nominal start; lunar: `{year}-{ordinal}`; astronomical: ISO date of maximum).
- **`rule_id`, `rule_version`, `engine_version`, `generated_at`.** Without `rule_id` you cannot delete-and-regenerate a single rule's rows, cannot answer "which rule produced this", and cannot do incremental materialization. Versions make regeneration auditable and deterministic (§4.4).
- **`scope` + `geom geography(geometry)` replaces `centroid geography(point)`.** `ST_DWithin(geom, here, r)` is true for a polygon when `here` is within `r` of it (distance to a polygon you're inside is 0), so a single GiST on `(geom, during)` serves point-anchored *and* area-anchored occurrences (eclipse umbra path, aurora oval band, meteor-shower visibility band as a lat-band polygon split into ≤4 quadrant pieces to avoid geography >hemisphere ambiguity **[docs, I believe]**). `global` rows (equinoxes, moveable feasts with no place) are a few hundred rows and are `UNION ALL`-ed in via the tiny `occ_global_during` index. This is how you avoid 20 k places × 36 new moons = 720 k junk rows.
- **`granularity`.** Wildlife/seasonal windows are day-granular (stored as `[local 00:00 at place.timezone, local 00:00 next day)`); eclipses/conjunctions are instant-granular (UTC instants). Clients need to know which to render (`Apr 1–20` vs `17:42 local`). `tstzrange` is correct for both — it stores instants, so DST and time-zone spanning are handled by construction. The rule engine must convert local dates using the *place's* `timezone` (not the server's); do this server-side only.
- **`confidence numeric`** instead of the `confidence` enum. §6 says user reports will "tune … the confidence indicator" — you cannot tune an enum. Keep a `confidence_label` view/computed column for display.
- **`status` on occurrence.** Drafts must be materializable for admin preview but invisible publicly; RLS on `occurrence` needs a column to filter on. Copy from phenomenon at materialization.
- **`created_at`/`updated_at`** — see 3.5.
- **Exclusion constraint** — cheap insurance (needs `btree_gist` for `uuid =`). If a legitimate rule needs overlapping windows at one place (unlikely), split it into two rules.

The full block above (plus the `place` DDL in 3.3) was executed on PostgreSQL 16 / PostGIS 3.4 and compiles **[measured]**; `st_dwithin(polygon, point_inside, 1)` returns true, confirming the single-predicate point+area approach.

Hot-path sizing **[measured]**: heap 205 MB at 1 M rows with the text PK; expect ~150 MB heap + ~110 MB composite GiST + ~30 MB uuid PK after these changes **[est]**.

### 3.2 `rule`: versioning, ordering, place optionality

```sql
create table rule (
  id            uuid primary key,
  phenomenon_id uuid not null references phenomenon(id) on delete cascade,
  place_id      uuid references place(id),          -- null for scope 'area'/'global' rules
  scope         occurrence_scope not null default 'place',
  kind          text not null check (kind in ('fixed_annual','seasonal_band','lunar','astronomical','explicit','cadence','rrule','override')),
  params        jsonb not null,
  confidence    numeric(3,2) not null check (confidence between 0 and 1),
  version       int not null default 1,             -- bump on any params change (trigger)
  active        bool not null default true,
  source_id     uuid references source(id),         -- provenance per rule, not only per phenomenon
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index rule_phenomenon on rule (phenomenon_id);
create index rule_place      on rule (place_id);

-- what has been materialized, for incremental/idempotent runs
create table rule_materialization (
  rule_id        uuid references rule(id) on delete cascade,
  season_year    int  not null,
  rule_version   int  not null,
  engine_version text not null,
  inputs_hash    text not null,                     -- hash of astronomy tables etc. used
  row_count      int  not null,
  materialized_at timestamptz not null default now(),
  primary key (rule_id, season_year)
);
```

`override` kind: admin "correct a window" must be persisted as a rule (highest precedence, explicit windows) — if it's applied to `occurrence` directly the nightly job erases it. `rrule` kind: see Rule engine §.

### 3.3 `place`: geometry index, hierarchy, tz, derived fields

```sql
create table place (
  id           uuid primary key,
  slug         text not null unique,
  name         text not null,
  kind         text not null check (kind in ('point','park','city','region','country')),   -- drop 'global' (it's a scope, not a place)
  geom         geography(geometry,4326) not null,
  centroid     geography(point,4326) generated always as (st_pointonsurface(geom::geometry)::geography) stored,
  bbox         geometry(polygon,4326) generated always as (st_envelope(geom::geometry)) stored,  -- cheap prefilter for bundles/tiles
  country_code char(2),
  admin_code   text,                                 -- ISO 3166-2 where applicable
  timezone     text not null,                        -- IANA; for multi-tz regions, tz of centroid
  elevation_m  int,
  geomag_lat   numeric(5,2),                         -- for aurora rules; precompute offline (AACGM/IGRF)
  parent_id    uuid references place(id),
  path         ltree,                                -- materialized ancestry for roll-ups + breadcrumbs (create extension ltree)
  status       text not null default 'published' check (status in ('draft','published','archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index place_geom_gist on place using gist (geom);
create index place_path_gist on place using gist (path);
```

- `st_pointonsurface` over `st_centroid`: the centroid of Chile, Norway or a crescent-shaped park is outside the polygon.
- Roll-ups ("what's happening in Japan in April"): prefer **spatial** roll-up (`st_intersects(place.geom, occurrence.geom)`) over hierarchy — it works for parks that straddle states and for area-scoped occurrences. Use `path ltree` for breadcrumbs and SEO URLs only.
- `geomag_lat`, `elevation_m`: inputs to aurora and gradient rules; cheap to precompute once per place.

### 3.4 `phenomenon`: search index, slug immutability, i18n seam

```sql
  search tsvector generated always as (to_tsvector('simple', name || ' ' || coalesce(summary,'') || ' ' || array_to_string(tags,' '))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index phenomenon_search_gin on phenomenon using gin (search);
create index phenomenon_tags_gin   on phenomenon using gin (tags);

-- slugs are URLs; never mutate them silently
create table slug_redirect (old_slug text primary key, entity text not null, new_slug text not null, created_at timestamptz default now());
```

i18n: don't build it in P0, but decide now that `name/summary/description_md` on `phenomenon`/`place` are the **default-language** columns and any translation lives in `phenomenon_i18n(phenomenon_id, lang, name, summary, description_md, search)`. That decision costs nothing now and avoids a column-per-language mess later. Keep `family` as an enum (5 values, product-level, stable; `alter type … add value` is fine). Move `kind`/`status`/`provider` check-constraint strings to enums or lookup tables only if you expect them to be user-visible facets — not needed in P0.

### 3.5 Sync/audit columns and tombstones everywhere

Every catalog table (`place`, `phenomenon`, `rule`, `occurrence`, `source`, `booking_offer`) gets `created_at`, `updated_at` (trigger-maintained) and — for tables that clients cache — `deleted_at`. Offline bundles and ISR both need "give me everything changed since `cursor`". Hard-deleting `phenomenon` cascades to `occurrence` and leaves phones with ghost rows; use `status='archived'` + `deleted_at` and let the nightly job archive occurrences.

### 3.6 References to occurrences from user/telemetry tables

```sql
create table report (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  phenomenon_id uuid not null references phenomenon(id),
  place_id uuid references place(id),
  occurrence_id uuid references occurrence(id) on delete set null,   -- convenience, not identity
  seen_at date not null, rating int check (rating between 1 and 5), note text, photo_path text,
  geom geography(point,4326),                                            -- where it was actually seen
  created_at timestamptz not null default now()
);
create index report_phen_seen on report (phenomenon_id, seen_at);   -- this is what tunes seasonal_band variance

create table affiliate_click (
  id bigint generated always as identity primary key,
  clicked_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  anon_id uuid,                                    -- cookie/device id for the 95 % of clicks that are anonymous
  offer_id uuid not null references booking_offer(id),
  occurrence_id uuid references occurrence(id) on delete set null,
  phenomenon_id uuid, place_id uuid,               -- denormalized so analytics survive occurrence churn
  surface text, context jsonb, ua_hash text, country char(2)
);
create index affiliate_click_time on affiliate_click (clicked_at);    -- partition by month once > ~50 M rows [est]
```

The report loop (§6.3) needs `(phenomenon_id, place_id, seen_at)` — a date and a thing — not an occurrence id that is regenerated nightly. Same for conversion analytics.

### 3.7 `booking_offer`

Add `valid tstzrange` (operator season), `updated_at`, `last_seen_in_feed_at`, `provider_payload jsonb`, `unique (provider, external_id)`, `create index on booking_offer (place_id) where active`. Affiliate feeds churn; you need idempotent upserts and expiry.

### 3.8 User tables and RLS boundaries

- All `user_id`/`owner_id` → `uuid not null references auth.users(id) on delete cascade`.
- Add `device(id uuid pk, user_id uuid, expo_push_token text unique, platform text, last_seen_at timestamptz, coarse_geom geography(point), locale text)` — §4.3's daily digest with last-known coarse location has no table.
- `trip_leg.place_id` → FK. `trip_leg.dates daterange` is right (trips are day-granular); the Plan query converts it to `tstzrange` at `place.timezone` bounds, or simply pads by ±1 day (14 h max offset; edge imprecision is invisible to users).
- Policies:
  - Catalog: `for select using (status = 'published')` on `phenomenon`, `place`, `occurrence`, `booking_offer`; writes only via `service_role` or admin role (`(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`, or a `user_role` table). Admin preview of drafts through an `admin_*` view with its own policy.
  - User tables: `using ((select auth.uid()) = user_id)` — wrap in `select` for plan caching **[docs, Supabase RLS performance guide]**; index every `user_id` column.
  - `trip` sharing: don't try to express "row readable if request carries token" in RLS. Use a `security definer` RPC `get_shared_trip(token)` that returns a read-only projection.
  - `affiliate_click`: `insert` allowed for `anon` and `authenticated` (with a check that `user_id is null or user_id = auth.uid()`); no `select` for clients.
  - `report.photo_path` → Storage bucket policy keyed on `auth.uid()` prefix.
  - Grant `execute` on `explore()`/`plan()` RPCs to `anon`; revoke direct `select` on `occurrence` if you want to force the RPC path (recommended — it keeps geometry/range serialization in one place).

---

## 4. Rule engine (§3.2)

### 4.1 Are six kinds sufficient? Nearly — add two, tighten two.

| Kind | Assessment |
|---|---|
| `fixed_annual` | Fine. Specify: windows where `endMonthDay < startMonthDay` roll into the next year (southern summer); `season_key` = year of start; Feb 29 → Feb 28 in non-leap years; local midnight in `place.timezone`. |
| `seasonal_band` | Right *concept* (never a single date) but the representation is too flat — see 4.2. |
| `lunar` | `calendar: 'hijri'|'hebrew'|'chinese'|'hindu'|'easter'` conflates computable calendars (Hebrew, Easter — Gregorian and Julian variants; Chinese via astronomical new moons at UTC+8) with observational (Hijri: Umm al-Qura tabular vs local sighting, ±1 day → surface as `peak ± 1 d`, confidence ≤ 0.7) and with "Hindu", which is not one calendar (Vikram Samvat/Shaka/regional amānta vs pūrṇimānta). Recommendation: `lunar` handles `hebrew`, `easter_western`, `easter_orthodox`, `chinese`, `hijri_umm_al_qura`; everything Hindu/regional goes through `explicit` windows ingested from a curated/holiday-API table with a `source`. Libraries: `@hebcal/core` (Hebrew), Meeus/Butcher for Easter, `astronomy-engine` for new moons (Chinese), tabular Hijri is ~20 lines. |
| `astronomical` | Right, but `table: 'eclipse'|'meteor'|'moon_phase'|'equinox'` needs `'tide'` (king tides = perigean spring tides, computable from moon perigee + syzygy) and `'aurora_season'`. See 4.3 for visibility derivation. |
| `explicit` | Fine; it is also the escape hatch for one-off events (Olympics host, Kumbh Mela location) and for `override`. Store `year` → `season_key`. |
| `cadence` | Fine for every-N-years; but "every Saturday in June–August", "4th Thursday of November", "first full week of October" are common for markets/festivals and not representable. |
| **add `rrule`** | RFC 5545 recurrence (`rrule` npm) with `DTSTART` in place tz + `durationDays`. Covers `fixed_annual`, `cadence`, nth-weekday and weekly-in-season in one well-tested grammar. Keep `fixed_annual`/`cadence` as sugar or fold them in. |
| **add `override`** | Admin/moderator correction to a specific `(place, season_key)`; highest precedence; emitted by the "correct a window" flow so it survives regeneration. |

Consider (later, not P0): `relative` — offset from another phenomenon's occurrence ("sardine run ≈ 2–4 weeks after the cold-water front"; "coral spawning = 3–6 nights after the Nov full moon" is really `lunar`-of-`astronomical`). Represent as `{ kind:'relative', ofRuleId, offsetDays:[min,max] }` when you have a second-order case worth it.

### 4.2 `seasonal_band` representation

Current: `typicalStart/typicalEnd/peak/varianceDays/climateNote` per rule, one rule per place. Problems:

- **Fronts.** Cherry blossom (Kyushu late Mar → Hokkaido early May), fall foliage (north→south, high→low), lavender, monsoon onset are *gradients*. One rule per place = hundreds of hand-maintained rules for one phenomenon. Add an optional gradient so one rule attached to a region produces per-place shifts:

  ```ts
  { kind: 'seasonal_band',
    peakDoy: number, halfWidthDays: number,           // window = peak ± halfWidth; band chart uses this
    peakSigmaDays: number,                              // uncertainty of the peak (tuned by reports)
    gradient?: { anchor: { lat: number; elevM: number },
                 daysPerDegLat: number,                 // e.g. +3.5 for blossom (later further north), −4 for foliage
                 daysPer100mElev: number },
    driver?: 'photoperiod'|'temperature'|'snowmelt'|'rainfall'|'sst'|'unknown',
    hemisphere: 'N'|'S'                                 // explicit — never auto-flip (see below)
  }
  ```

  Materialize: for each place under the rule (region rule → all descendant/intersecting places of kind `point|park|city`), `peak = peakDoy + gradient.daysPerDegLat*(lat−anchor.lat) + gradient.daysPer100mElev*(elev−anchor.elev)/100`.

- **Hemisphere.** Do not auto-shift 182 days for the south: monsoon, whale migration, foliage all have hemisphere-specific *and* coast-specific timing. Require an explicit rule per hemisphere/region; the engine should *refuse* a N-hemisphere rule attached to a S-hemisphere place (validation in `packages/domain`).
- **Variance semantics.** Distinguish *window half-width* (how long it lasts) from *peak uncertainty* (how sure we are when it peaks). The reports loop tunes the second; the first is biology. Both feed `confidence`.
- **Tuning from reports.** `report(phenomenon_id, place_id, seen_at)` histograms → update `peakDoy/peakSigmaDays` and bump `rule.version` through a moderated proposal, never a live write; this keeps regeneration deterministic.

### 4.3 Astronomical visibility derivation

- **Eclipses.** Ingest path polygons (NASA GSFC / Jubier KMZ → umbra path + penumbra region) into `astro_event(id, kind, at_max timestamptz, umbra geography, penumbra geography, magnitude, source_id)`. Emit **area-scoped** occurrences: one row `scope='area', geom=umbra` (confidence 1.0, "total") and one `geom=penumbra` (confidence 0.8, "partial"). Do *not* intersect against every place — the composite GiST does that at query time. Optionally also emit place-scoped rows for the ≤50 curated "eclipse destinations" so they get SEO pages.
- **Meteor showers.** Visibility ≈ radiant declination: observable where `lat > dec − 90°` (north) / `lat < dec + 90°` (south); moon phase at maximum sets quality. Emit one `area` occurrence with a latitude-band polygon (split into 4 longitude quadrants so no geography polygon exceeds a hemisphere) and `confidence` scaled by moon illumination at peak (`astronomy-engine`). Peak = ZHR max night ± 1 day; window = activity period from the IMO calendar.
- **Aurora.** Not a "shower" but a season × geomagnetic latitude: `rule.kind='astronomical', table:'aurora_season', params:{ minGeomagLat: 58, season:'Sep–Mar' | 'Mar–Sep' }`. Emit `area` rows using an auroral-oval band polygon in geomagnetic coordinates converted to geographic (precompute once; it moves slowly), or simpler: place-scoped rows for places with `place.geomag_lat >= minGeomagLat` (this is what `place.geomag_lat` is for). Kp-driven real-time alerts are a later, separate feed (NOAA SWPC) — do not model them as occurrences.
- **Moon phases / equinoxes / solstices / supermoons / dark-sky new moons.** Compute with `astronomy-engine` (pure JS, deterministic, no network) → `scope='global'` instants. "Dark-sky new moon at *this* park" is a *join* at query time (global occurrence × place with `tags @> '{dark_sky}'`), not 20 k rows.
- **Midnight sun / polar night.** Latitude bands too (`|lat| > 66.5°`, with the classic dates shifted by latitude — compute via `astronomy-engine` sunrise/sunset search per place; these are place-scoped rows for the ~200 relevant places).

### 4.4 Deterministic, versioned regeneration

Contract: `materialize(rule, place, seasonYear, inputs) → Occurrence[]` is pure and **the same version always yields byte-identical rows**. To make that true:

1. `rule.version` bumps on any `params` change (trigger); `engine_version` is the `packages/domain` semver; `inputs_hash` = hash of the astronomy/holiday tables used (`data/tables/*.json` are content-addressed).
2. `rule_materialization(rule_id, season_year)` records what was produced. The nightly job re-materializes only where `(rule_version, engine_version, inputs_hash)` differ or a new season year enters the rolling window — not everything. Full rebuild of 1 M rows is ~12 s locally **[measured, Docker, not Supabase micro]** so even the dumb path is fine early, but incremental keeps `updated_at` meaningful for sync and avoids nightly bloat/autovacuum churn.
3. Write path per `(rule, year)`, in one transaction: compute rows → `insert … on conflict (rule_id, place_id, season_key) do update set … where occurrence.* is distinct from excluded.*` → `delete from occurrence where rule_id=$1 and season_key like $year% and id not in (…)`. Idempotent; re-running produces no writes.
4. Golden-file tests in `packages/domain`: for each kind, a fixture rule → expected occurrences for 2025–2027. CI fails when the engine changes output without a version bump.

---

## 5. Query & performance

### 5.1 Measurements (1 M occurrences, PostGIS 3.4, warm cache, Docker on a dev VM)

| Query | Design's indexes (separate GiST `centroid`, GiST `window`, btree `family`) | Composite GiST `(geom, during)` |
|---|---|---|
| Explore: 200 km, 14 d, 2 families, rank+`LIMIT 50` | 19.9 ms, 899 buffers (BitmapAnd of 1 497 geo × 45 518 time candidates) | **6.4 ms, 234 buffers** (index scan, 64 candidates) |
| Plan: 500 km, 90 d, all families, rank+`LIMIT 50` | 47.5 ms, 1 933 buffers (4 913 × 115 330) | **4.8 ms, 652 buffers** (561 candidates) |
| Count for facets: 200 km, 14 d | 11.0 ms | **0.4 ms** |
| Worst case: 2 000 km, 365 d, 10 499 candidates scored | — | 110 ms (63 ms if ordered by start instead of score) |
| Adding `family` into the GiST via `btree_gist` `(family, geom, during)` | — | no material gain (7.8 ms) — not worth the write cost |

**[measured]** The design's indexes work — nothing falls over at 1 M — but the planner must `BitmapAnd` two large candidate sets because the time predicate alone matches ~4.5 % of rows for a 14-day query (it grows with the horizon) and the geo predicate matches ~0.15 %. The composite GiST intersects both in the index and is 3–10× cheaper in buffers. At 100 k rows everything is <5 ms either way; at 10 k it's noise. The composite index is what carries you from 1 M to 10 M rows without redesign **[est]**.

Row estimates were poor (`rows=2` estimated vs 12–379 actual) — expected for GiST range/geo selectivity. Harmless at `LIMIT 50` but watch for bad join plans when you join `phenomenon`/`booking_offer`; join after the `LIMIT` (CTE or lateral) rather than before.

### 5.2 Ranking: in SQL, at the candidate set, with a guardrail

Rank in SQL. The candidate set after geo × time is hundreds to low thousands of rows; scoring them in Postgres and returning 50 is far cheaper than shipping 10 k rows to a Vercel function or a phone. `rank_score` as a `sql immutable` function inlines fine **[measured — it was inlined into the sort key]**. Two guardrails:

- Cap `radius_m × horizon_days` (e.g. 2 000 km × 365 d is the "expand to region" fallback) — the 110 ms worst case is dominated by scoring 10 k rows; cap or pre-filter with `lower(during) < :to and upper(during) > :from` order + `LIMIT 2000` before scoring.
- Use `st_distance(geom, here, false)` (sphere, not spheroid) inside the score; precision doesn't matter for ranking. **[measured: no significant difference at 10 k rows, but it's free.]**

Weights live in a `config` row read once per request (or baked into the RPC with `set_config`), as the design says. `interestMatch` = `cardinality(tags & :interests)` — keep tags on `occurrence` (denormalized) so no join is needed to score.

### 5.3 Pagination

- **Explore** (score depends on `now` and GPS): no server pagination. Return 50 (or 100) and let the client page/scroll. Scores drift as the user moves anyway.
- **Plan / landing pages / calendar** (ordered by time): keyset pagination on `(lower(during), id)` — stable, index-backed by `occ_place_during`/`occ_phenomenon`. Never `OFFSET`.
- **Map**: return points, not cards. Server-side: `select st_geohash(geom::geometry, :precision) as cell, count(*), min(...)` grouped by cell for zoomed-out views; raw points under ~2 000 in the viewport. Client clusters with `supercluster`. Time scrubber re-queries with the same bbox and new range — cheap with the composite index.

### 5.4 Caching

- **ISR for user-independent pages** (`/p/[slug]`, `/place/[slug]/[month]`, `/when-to-see/*`): `revalidate = 86400` plus **on-demand** `revalidateTag('catalog')` triggered by the nightly job (pg_cron → `pg_net` POST to a Vercel route with a shared secret). Pages then update within minutes of a catalog change and never serve stale windows for a day.
- **Explore API**: quantize the cache key — `geohash(5)` (~5 km cell) × `date` × `radius bucket` × sorted families/interests — and set `Cache-Control: s-maxage=3600, stale-while-revalidate=86400` on the route. Real-world Explore traffic clusters heavily by city/day; this turns most requests into edge hits **[est]**. Put `now()` in the score at day granularity so the cached ordering is valid for the whole day.
- **Sitemaps**: generate from `phenomenon × place` pairs that have ≥1 published occurrence in the next 24 months; regenerate nightly.

---

## 6. Offline / sync (Expo)

Split the problem: the **catalog is read-only and shared** (bundle/cache), **user data is per-user and small** (outbox).

### 6.1 Catalog bundles

- **Bundle unit** = `(cell, season)`: cell = geohash-3 (~156 × 156 km at the equator; ~5–20 k km² at high latitudes) or H3 res 3; season = calendar quarter. A trip leg `(place, dates)` maps to the cells intersecting `buffer(place.centroid, radius)` × the quarters overlapping `dates ± 14 d`. Typical leg: 4–9 cells × 1–2 quarters.
- **Contents**: occurrences (flattened: `id, phenomenon_id, place_id, family, tags, starts_at, ends_at, peak_starts_at, peak_ends_at, confidence, lat, lng, scope, geom_geojson?`), the referenced `phenomenon` summaries and `place` names, offer summaries, thumbnail URLs. `global`-scope occurrences ship in a single small `global.json` every client always has. Area-scoped polygons ship simplified (`st_simplifypreservetopology` ≤ 2 kB each).
- **Production**: a nightly step after materialization writes each bundle as gzipped JSON to Supabase Storage at `bundles/{catalog_version}/{cell}/{quarter}.json.gz`, plus a tiny manifest `bundles/manifest.json` = `{ catalog_version, cells: { cell: { quarter: bytes } } }`. Immutable paths + long `Cache-Control`; the CDN does the rest. Alternatively a `bundle(cell, quarter)` RPC computed on demand with an `ETag` — simpler for P3, switch to prebuilt when >1 k downloads/day **[est]**.
- **Client storage**: `expo-sqlite` (SDK ≥ 50 API) with tables mirroring the flattened shape; indexes on `(starts_at, ends_at)` and `(lat, lng)`. A 200 km × 30 d slice is ≤ a few thousand rows — bbox prefilter in SQL then haversine + `rankScore` in JS (this is the genuinely shared `packages/domain` code). Don't depend on SQLite R*Tree being compiled in; you don't need it at this size.
- **Freshness**: client stores `catalog_version` per bundle; on app open with connectivity, fetch `manifest.json` (a few kB), re-download bundles whose version changed. Tombstones aren't needed for bundles (whole-bundle replacement) — they're needed for *incremental* API caches (TanStack Query) if you ever do `updated_at`-cursor deltas; the `updated_at`/`deleted_at` columns from §3.5 make that possible later.
- **Media**: `expo-file-system` cache directory keyed by URL hash; cap per trip (e.g. 50 MB) and evict LRU.

### 6.2 User data (trips, saves, alerts, reports)

- Local-first with an **outbox**: writes go to SQLite (`trip`, `trip_leg`, `save`, `report`) and to an `outbox(id, table, op, payload, created_at)` row. Client generates the `uuid` PKs (the design already uses uuid PKs — keep it that way; never rely on server-generated ids for user rows).
- Replay on reconnect (`@react-native-community/netinfo` → TanStack `onlineManager`): idempotent `upsert` via `supabase-js` in order; on 409/RLS error, park the row and surface a "couldn't sync" badge. Conflict policy: last-write-wins by `updated_at` — a single user editing their own trip on two devices is the only conflict and LWW is acceptable.
- `report` photos: upload to Storage in the outbox drain, then patch `photo_path`.
- Read caches: TanStack Query with `persistQueryClient` + MMKV (`react-native-mmkv`) for phenomenon detail/offers so Detail works offline for anything viewed or bundled.
- **Not recommended for v1**: PowerSync/WatermelonDB/ElectricSQL. They solve bidirectional sync of large shared datasets; here the shared dataset is read-only (bundles) and the writable dataset is per-user and tiny. Revisit at Phase B (operator inventory).

---

## 7. Operational concerns

- **Rematerialization churn**: with nightly delete+insert of 1 M rows, autovacuum on `occurrence` and its GiST indexes becomes the dominant maintenance load; GiST indexes don't shrink. The incremental/`is distinct from` write path (§4.4) makes the nightly delta near-zero. Schedule `vacuum (analyze) occurrence` after the job regardless. **[est]**
- **Migrations**: `alter table occurrence` on a 1 M-row table with a GiST index rebuild takes minutes and locks reads — another reason to get this table right *now* and to add columns as nullable-without-default later.
- **Time zones in jobs**: `pg_cron` runs in UTC; "nightly" should run after the last time zone's midnight if you want "today" semantics globally, or just run at 04:00 UTC and let Explore use `now()`.
- **Statistics**: `alter table occurrence alter column during set statistics 1000` helps range selectivity a bit; don't expect miracles from GiST estimates.
- **Supabase specifics**: enable `postgis`, `btree_gist`, `ltree`, `pg_cron`, `pg_net` in the first migration; PostGIS objects live in the `extensions` schema on Supabase — qualify or set `search_path` in functions **[docs]**. Use `supabase db lint` in CI as planned; add `plpgsql_check` if you write plpgsql materializers.
- **Backups/PITR**: Pro tier daily backups; enable PITR add-on once the catalog is hand-curated and irreplaceable (before P1 seed work finishes) **[docs]**. Also keep `supabase/seed/*.yaml` as the human-editable source of truth so the DB is reproducible from Git.
- **Secrets/affiliate redirect**: the `affiliate/redirect` Edge Function should sign or HMAC its `offer_id` param to prevent click-spam and log at most one click per `(anon_id, offer_id, day)`.
- **Observability**: `pg_stat_statements` is on by default on Supabase; add a weekly query looking for `Seq Scan on occurrence`.
- **Data licensing**: eBird/GBIF/iNaturalist have non-commercial or attribution terms that differ; recording `license` per `source` is planned — also record `terms_url` and `commercial_ok bool` so the affiliate surfaces can be filtered by license automatically.

---

## 8. Nice-to-haves (not blocking Phase 0)

- `confidence` decomposition: `data_quality` (source-driven) × `year_uncertainty` (variance-driven) → single displayed number.
- `occurrence.quality jsonb` for astronomy (moon illumination at meteor peak, eclipse obscuration fraction, ZHR).
- `phenomenon.related` many-to-many (aurora ↔ dark-sky new moon; salmon run ↔ bear viewing) for "also happening" modules.
- `place.popularity` and `phenomenon.popularity` (click/save counts, refreshed nightly) as a ranking term and sitemap priority.
- Table partitioning of `occurrence` by season year once >10 M rows **[est]** — the composite GiST keeps single-table fine well beyond v1.
- Postgres `pg_trgm` on `phenomenon.name` for typo-tolerant search alongside the tsvector.
- ICS feeds per `trip` and per `save` (cheap SEO/retention win; the data is already range-typed).

---

## 9. Open questions for the founder

1. **Area-vs-place SEO**: eclipse/meteor/aurora occurrences will be area-scoped. Which ~50–100 "destination" places should *also* get place-scoped rows so `/when-to-see/total-eclipse-in-…` pages exist? (Affects seed catalog, not schema.)
2. **Confidence semantics**: is `confidence` "how sure are we of the dates" or "how likely will a visitor actually see it"? Users read it as the latter; the report loop tunes the former. Decide before the UI copy is written.
3. **How much rule authoring happens in Admin vs YAML in Git?** If Admin edits rules, `rule.version` + `rule_materialization` are mandatory; if Git is the source of truth, Admin only creates `override` rules and the YAML → DB import is the versioning.
4. **Hijri/Hindu observances**: accept ±1-day uncertainty displayed as a band, or defer these to `explicit` windows from a holiday API (with its licensing)?
5. **Anonymous identity**: is a device/anon id acceptable for `affiliate_click` attribution and offline saves-before-login (later merged into the account)? Needed for the "95 % of traffic is anonymous SEO" model.
6. **Explore horizon defaults** for the region fallback: how far (km) and how long (days) may the fallback expand? This sets the cap in §5.2 and the bundle radius in §6.1.
7. **Mobile framework**: given §2.3, is the RN choice about team size (one language) or about assumed engine sharing? If the latter, the assumption is weaker than the doc states — worth re-deciding explicitly with the Flutter team's actual velocity.

---

### Appendix — benchmark setup (for reproduction)

PostGIS 3.4 / Postgres 16 (`postgis/postgis:16-3.4`), `shared_buffers=1GB`, `work_mem=64MB`. Table per §3.1 with `window` quoted; 998 241 rows: ~4 750 phenomena × ~70 places × 3 years, 20 k places clustered ±3° around 400 random hotspots, window start uniform over 2025–2027, length 7–67 days. Queries used `explain (analyze, buffers)` after warm-up; ranking via a `sql immutable` `rank_score(during, peak, confidence, dist_m, radius_m, t0)` approximating the design's §5 ranking formula. Numbers are for one machine and one synthetic distribution — treat them as relative, not absolute.
