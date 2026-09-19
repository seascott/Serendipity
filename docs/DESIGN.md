# Serendipity — Design Document

*Time + place travel companion: know what the world is doing, where you are (or where you're going), when you're there — and book it.*

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

**Phase A — Affiliate (launch):** every Phenomenon × Place surface carries contextual booking modules: tours/activities (Viator, GetYourGuide), lodging (Booking.com / Expedia affiliate), flights later. Commission on click-through bookings; the app's job is *intent at the right moment* ("humpbacks peak here in 9 days — 3 whale-watch operators, from $85").

**Phase B — Marketplace:** onboard local operators directly (Stripe Connect), sell time-boxed inventory tied to occurrences ("aurora chase, Feb 12–20"), take a lower commission than the aggregators while giving operators demand forecasting from our calendar. Needs operator dashboard, availability, payouts, disputes — deferred.

Design consequences now:
- Bookings are a first-class entity (`booking_offer`) linked to Occurrence, not an afterthought widget.
- Every affiliate click is tracked (`affiliate_click`) so we can prove conversion per phenomenon/place before building the marketplace.
- Landing pages must be crawlable (SEO) — organic search for "when to see X in Y" is the acquisition channel.

## 3. Core Domain Model

Separate the **timeless definition** of a thing from its **concrete dated windows**.

```
Phenomenon            timeless definition ("Monarch migration through central Mexico")
  └── Rule(s)         how to compute windows: fixed date, lunar, seasonal-band, astronomical table, curated list
        └── Occurrence  materialized window for one year at one place: start / peak / end + confidence
Place                 point, polygon, or named region (country/state/park) with PostGIS geometry
Source                provenance for each phenomenon/rule (URL, license, last verified)
BookingOffer          bookable tour/activity/stay tied to a Place (and optionally a Phenomenon)
```

### 3.1 Postgres schema (Supabase)

```sql
create type family as enum ('wildlife','astronomy','cultural','seasonal_nature','activity');
create type confidence as enum ('high','medium','low');

create table place (
  id uuid primary key, slug text unique, name text not null,
  kind text check (kind in ('point','park','city','region','country','global')),
  geom geography(geometry, 4326) not null,      -- point or polygon
  centroid geography(point, 4326) not null,
  country_code char(2), timezone text not null,
  parent_id uuid references place(id)
);

create table phenomenon (
  id uuid primary key, slug text unique, name text not null,
  family family not null, tags text[] default '{}',
  summary text, description_md text,
  practical jsonb,                               -- tips, access, cost hint, crowd level
  status text check (status in ('draft','published','archived')) default 'draft',
  contributed_by uuid, moderated_by uuid,
  search tsvector generated always as (to_tsvector('simple', name || ' ' || coalesce(summary,''))) stored
);

create table rule (
  id uuid primary key,
  phenomenon_id uuid references phenomenon(id) on delete cascade,
  place_id uuid references place(id),
  kind text check (kind in ('fixed_annual','seasonal_band','lunar','astronomical','explicit','cadence')),
  params jsonb not null,                         -- shape per kind, validated in domain package
  confidence confidence not null
);

create table occurrence (                        -- materialized, queryable
  id text primary key,                           -- {phenomenon_id}_{place_id}_{year}
  phenomenon_id uuid references phenomenon(id) on delete cascade,
  place_id uuid references place(id),
  family family not null, tags text[],
  window tstzrange not null,                     -- start..end
  peak   tstzrange,                              -- peak_start..peak_end (null = whole window)
  confidence confidence not null,
  centroid geography(point, 4326) not null
);
create index on occurrence using gist (centroid);
create index on occurrence using gist (window);
create index on occurrence (family);

create table source (id uuid primary key, url text, license text, last_verified date, note text);
create table phenomenon_source (phenomenon_id uuid, source_id uuid, primary key (phenomenon_id, source_id));

create table booking_offer (
  id uuid primary key, provider text,            -- 'viator' | 'gyg' | 'booking' | 'own'
  external_id text, title text, kind text check (kind in ('tour','activity','stay')),
  place_id uuid references place(id), phenomenon_id uuid references phenomenon(id),
  price_from numeric, currency char(3), url text, deep_link_params jsonb, active bool default true
);
create table affiliate_click (id bigserial primary key, user_id uuid, offer_id uuid, occurrence_id text, clicked_at timestamptz default now(), context text);

-- user side
create table trip (id uuid primary key, owner_id uuid, name text, share_token text unique, created_at timestamptz default now());
create table trip_leg (id uuid primary key, trip_id uuid references trip(id) on delete cascade, place_id uuid, dates daterange not null, position int);
create table save (user_id uuid, phenomenon_id uuid, note text, remind_days_before int, primary key (user_id, phenomenon_id));
create table alert (id uuid primary key, user_id uuid, kind text, params jsonb, active bool default true);
create table contribution (id uuid primary key, user_id uuid, type text, payload jsonb, status text default 'pending', created_at timestamptz default now());
create table report (id uuid primary key, user_id uuid, occurrence_id text, seen_at date, rating int, note text, photo_path text);
```

The core query — *what's within R km, overlapping [from, to], in these families* — is one indexed statement:

```sql
select o.*, st_distance(o.centroid, :here) as dist_m
from occurrence o
where st_dwithin(o.centroid, :here, :radius_m)
  and o.window && tstzrange(:from, :to)
  and (:families is null or o.family = any(:families))
order by rank_score(o, :here, :from, :to, :interests) desc
limit 50;
```

### 3.2 Rules

```ts
type Rule =
  | { kind: 'fixed_annual';   startMonthDay: string; endMonthDay: string; peakMonthDay?: string }
  | { kind: 'seasonal_band';  typicalStart: string; typicalEnd: string; peak: string; varianceDays: number; climateNote?: string }
  | { kind: 'lunar';          calendar: 'hijri'|'hebrew'|'chinese'|'hindu'|'easter'; offsetDays: number; durationDays: number }
  | { kind: 'astronomical';   table: 'eclipse'|'meteor'|'moon_phase'|'equinox'; filter: Record<string, unknown> }
  | { kind: 'explicit';       windows: { year: number; start: string; peak?: [string,string]; end: string }[] }
  | { kind: 'cadence';        everyNYears: number; anchorYear: number; startMonthDay: string; endMonthDay: string };
```

Rule evaluation is a **pure function** in `packages/domain` (`materialize(rule, place, year) → Occurrence[]`) so web, mobile and the nightly job share one implementation and it is trivially unit-tested. `seasonal_band` items always render as *peak ± variance*, never a single date.

## 4. Architecture

### 4.1 Recommendation: TypeScript monorepo — Next.js + Expo + Supabase

Chosen because of three answers: **global catalog**, **Plan at parity on web**, **affiliate revenue**. Together they make *organic search* the acquisition channel, and "when to see [phenomenon] in [place]" pages must be server-rendered and indexable. Flutter web renders to canvas and is effectively invisible to crawlers; that alone rules it out for the web tier. A single TypeScript codebase then lets web and mobile share the domain logic, API client and design tokens.

```
┌────────────── apps/web (Next.js, App Router) ──────────────┐   ┌──────── apps/mobile (Expo / React Native) ────────┐
│ SSG/ISR landing pages: /p/[slug], /place/[slug]/[month],    │   │ Explore (GPS, next-N-days), Map, Trip, Detail,    │
│ /when-to-see/[phenomenon]-in-[place]                        │   │ offline trip bundles, push alerts                 │
│ Plan UI, Trip, Detail, Calendar, Contribute, Admin/moderate │   │ Expo Router, expo-location, expo-notifications    │
└─────────────────────────────┬───────────────────────────────┘   └───────────────────────┬──────────────────────────┘
                              │           packages/domain  (models, Rule → Occurrence, ranking, zod schemas)
                              │           packages/api     (typed Supabase client, queries, React Query hooks)
                              │           packages/ui      (Tamagui or shared tokens; RN + web primitives)
                              ▼
┌──────────────────────────── Supabase ─────────────────────────────┐
│ Postgres + PostGIS (source of truth; geo × tstzrange queries)      │
│ Auth (anon browse, magic link, Apple/Google)   Storage (media)     │
│ Edge Functions / pg_cron:                                          │
│   • materialize_occurrences  nightly, rolling 3 years              │
│   • evaluate_alerts          hourly → Expo Push / email (Resend)   │
│   • ingest/*                 astronomy tables, Wikidata, eBird     │
│   • affiliate/redirect       click logging + deep-link builder     │
│ RLS policies for user tables; published catalog is public-read     │
└────────────────────────────────────────────────────────────────────┘
Hosting: Vercel (web) · EAS (mobile builds/OTA) · Supabase Cloud
```

**Why not the SeaFoundry stack (Flutter + Firebase):** Flutter is excellent for the mobile half and the team knows it, but (a) no SEO on web, (b) Firestore cannot express `geo radius × date range × facets` without a third-party index (Typesense/Algolia), whereas PostGIS + `tstzrange` GiST indexes do it natively, and (c) a relational catalog with many-to-many joins (phenomenon ↔ place ↔ source ↔ offers) fits SQL far better than documents.

**Considered alternative:** Flutter mobile + Next.js web, both on Supabase. Keeps Flutter skills, but two UI codebases with two model layers; only worth it if a Flutter mobile team already exists. Revisit if RN velocity disappoints.

### 4.2 Astronomy is computed, not curated
Eclipse/meteor/moon-phase tables (NASA, IMO) are ingested once into `data/tables/`; visibility per place is derived (eclipse path polygon ∩ place geometry, aurora by geomagnetic latitude band, meteor radiant altitude by latitude).

### 4.3 Offline & background
Trips download an "occurrence bundle" (JSON + thumbnails) so Explore works in parks without signal. Background location is **not** required for v1 — Explore alerts run on app open plus an optional daily push digest using last-known coarse location.

### 4.4 Deep links / URLs (shared web ↔ mobile via Expo Router + universal links)
`/p/{slug}` · `/place/{slug}?from=&to=` · `/when-to-see/{phenomenon}-in-{place}` · `/trip/{token}` · `/explore?lat=&lng=&days=`

## 5. Product Surface (v1)

| Screen | Purpose | Key interactions |
|--------|---------|------------------|
| **Explore (Home)** | "Near me, next 14 days" | radius + horizon sliders, family chips, cards sorted by *peak proximity × distance × confidence*; inline "Book a guide" |
| **Map** | spatial view of Occurrences | clustered pins, time scrubber along the bottom (drag month → pins re-filter) |
| **Plan** | destination + dates, or phenomenon-first | *"I'm going to ___ from ___ to ___"* and *"I want to see ___"* → best places/years |
| **Phenomenon detail** | everything about one thing | peak-window band chart across the year, next 3 occurrences, places, tips, sources, save/alert, add to trip, **booking module** |
| **Place × Month landing** (web) | SEO surface | "What's happening in Kyoto in April": occurrences, offers, add-to-trip |
| **Trip** | itinerary overlay | legs on a timeline with matching occurrences per leg; "shift dates" shows what you'd gain/lose; bookings per leg |
| **Calendar** | year at a glance | 12-month heat strip per saved/interest family |
| **Contribute** | community data | propose phenomenon, correct a window, post a field report ("it's happening now") |
| **Admin** (web) | moderation + catalog editing | approve contributions, edit rules, re-materialize |
| **Profile / Alerts** | interests, units, notification prefs | |

Ranking score for Explore (v1, tunable via a `config` table):
```
score = w1 * peakProximity(now, peak)             // 1.0 inside peak, decays outside
      + w2 * (1 - distanceKm / radiusKm)
      + w3 * confidenceWeight
      + w4 * interestMatch(user.interests)
      + w5 * hasBookableOffer                     // small nudge toward monetizable items
```

## 6. Data Strategy (the hard part)

Quality of the catalog *is* the product. Global-but-thin means breadth first, depth via automation and community:

1. **Seed catalog (~300 items)** across all five families, hand-written rules, every item with a `Source`. Target: top 50 tourism countries + globally visible astronomy + the 30 most-booked seasonal activities.
2. **Ingest pipelines** (Edge Functions / scripts, idempotent):
   - Astronomy: NASA eclipse catalog, IMO meteor calendar, computed moon phases/equinoxes.
   - Cultural: Wikidata (festival items with coordinates + dates), holiday APIs for moveable feasts.
   - Wildlife / seasonal nature: expert `seasonal_band` rules first; later fit peak ± variance from eBird/GBIF/iNaturalist observation histograms.
   - Activities: operator seasons from affiliate catalogs (Viator/GYG tag + availability calendars) + curated river-flow / snow / swell seasons.
3. **Ground truth loop**: user `report`s ("seen today") tune `seasonal_band` variance and the confidence indicator; moderation queue in Admin.
4. **Licensing**: license per source; CC-BY/CC0/own media only; original text summaries.

## 7. MVP Scope & Roadmap

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| **P0 — Skeleton** | Turborepo: `apps/web`, `apps/mobile`, `packages/{domain,api,ui}`; Supabase project + migrations above; RLS; auth (anon + magic link); `materialize()` for `fixed_annual` / `explicit` / `astronomical` with tests; CI (typecheck, lint, test) | 1 session |
| **P1 — Catalog + Explore + Detail** | seed ~100 phenomena + places, Explore (web + mobile), Phenomenon detail with band chart, Map with time scrubber, first affiliate module (Viator/GYG links) + click logging | 1–2 sessions |
| **P2 — Plan + Trips + SEO** | Plan (place+dates, phenomenon-first), Trip + share links, Calendar, `seasonal_band` + `lunar` rules, ISR landing pages `/when-to-see/*` and `/place/*/month`, sitemap | 1–2 sessions |
| **P3 — Community + Alerts** | Contribute + Admin moderation, Reports → confidence, push/email digests, offline bundles | 1–2 sessions |
| **P4 — Growth** | ingest pipelines (Wikidata, eBird, affiliate catalogs), lodging affiliate, ICS export, analytics on click → booking conversion | 1–2 sessions |
| **P5 — Marketplace** | operator onboarding, Stripe Connect, occurrence-bound inventory, payouts | 2–3 sessions |

External waits (separate from effort): Apple/Google developer accounts, Supabase + Vercel + EAS accounts, affiliate program approvals (Viator/GYG/Booking take days–weeks — apply during P0), data-source API keys.

## 8. Risks & Open Questions

- **Phenology variance**: climate shift makes "peak" fuzzy → variance bands + report loop; never a single date for `seasonal_band`.
- **Catalog breadth vs. quality**: global-thin risks a "nothing near me" empty state in most places; mitigate with astronomy (always something, everywhere), generous default radius, and "expand to region" fallback.
- **Affiliate dependence**: commissions and API terms change; log clicks from day one so the marketplace case is data-backed.
- **Name**: "Serendipity" is crowded on app stores/domains — check early (alternatives: *Whenabouts*, *Peakfinder*, *Tidewatch*).
- **Background location**: deferred; daily digest with last-known location covers most value with none of the permission friction.

## 9. Repo Layout

```
serendipity/
├── apps/
│   ├── web/                # Next.js (App Router): landing pages, Plan, Trip, Admin
│   └── mobile/             # Expo (Expo Router): Explore, Map, Trip, Detail
├── packages/
│   ├── domain/             # models, zod schemas, Rule → Occurrence, ranking (pure TS, 100% tested)
│   ├── api/                # Supabase client, typed queries, React Query hooks
│   └── ui/                 # shared primitives/tokens (Tamagui)
├── supabase/
│   ├── migrations/         # schema above
│   ├── functions/          # edge functions: materialize, alerts, ingest/*, affiliate redirect
│   └── seed/               # phenomena.yaml, places.yaml, sources.yaml (human-edited catalog)
├── data/tables/            # eclipses.json, meteor_showers.json (ingested astronomy tables)
├── docs/                   # this file, ADRs
└── .github/workflows/      # typecheck + lint + test + supabase db lint
```
