# Design Review Synthesis — pre-Phase-0

Two independent expert reviews of `docs/DESIGN.md` v1 (commit `10b7bab`), run as separate sessions with different lenses:

| Review | Lens | Verdict | Report |
|---|---|---|---|
| A | Travel product, SEO/growth, affiliate monetization, web+mobile architecture | **Confirm with changes** | [2026-09-travel-seo-architecture.md](2026-09-travel-seo-architecture.md) |
| B | Data model, PostGIS/temporal correctness, query performance (benchmarked at 1M rows), Supabase ops, offline sync | **Confirm with changes** | [2026-09-data-geo-architecture.md](2026-09-data-geo-architecture.md) |

## 1. Stack verdict — unanimous

Both confirm **Next.js + Expo + Supabase (Postgres/PostGIS)** over Flutter + Firebase.

- Postgres/PostGIS over Firestore is the decisive call and is independent of the UI framework. B: Firestore can technically express multi-inequality queries since 2024, but not geo ∩ range ∩ facets with server-side ranking without an index per facet combination and a client-side scan; Typesense/Algolia would be the realistic Firebase path — a second system to sync for the one query that *is* the product.
- Flutter web is a **category** risk (canvas rendering, HTML renderer deprecated); the recommended stack's risks are **execution** risks (maps, Expo upgrades, Tamagui, Supabase limits).
- Both independently made the same correction to v1's rationale: the "share `materialize()` across web/mobile/jobs" argument is weak — clients should never materialize rules; they download occurrences. Keeping `materialize()` server-side is the right architecture *and* keeps a Flutter-mobile hybrid genuinely cheap if RN velocity disappoints.

## 2. Blocking findings (both reviewers, independently)

| # | Finding | Fix (in DESIGN v2) |
|---|---|---|
| 1 | `occurrence.id = {phenomenon}_{place}_{year}` collides: Ramadan starts twice in 2030, king tides/supermoons/new moons are multiple per year, southern seasons span New Year. No `rule_id` → cannot regenerate or attribute rows. | Deterministic `uuid` v5 of `(rule_id, season_key, place_id)`; `season_key` assigned by rule kind; `rule_id`, `rule_version`, `engine_version` columns; `unique nulls not distinct (rule_id, place_id, season_key)`. |
| 2 | `st_dwithin(o.centroid, …)` on a point for coastline/region/country phenomena makes "nothing near me" **worse** (user in Sydney vs "humpback migration, east coast Australia" whose centroid is offshore). | `geom geography(geometry)` on `occurrence` (point / polygon / null) + `scope` enum `place|area|global`; `st_dwithin` on a polygon is 0-distance when inside, so one predicate serves both. |
| 3 | Two separate GiST indexes force a `BitmapAnd` of large candidate sets. B measured 1M rows: 20–48 ms / 900–1900 buffers vs **5–6 ms / 230–650 buffers** with composite `gist (geom, during)`. | Composite partial GiST; tiny partial index for `global` rows. |
| 4 | `report` and `affiliate_click` reference `occurrence.id` — a row rewritten nightly. | Denormalize `(phenomenon_id, place_id, date)`; `occurrence_id` nullable `on delete set null`. |
| 5 | No `created_at/updated_at/status` on catalog tables → no offline delta sync, no ISR revalidation trigger, no RLS filter on the table the public actually queries. | Sync/audit columns everywhere; `status` on `occurrence`; `deleted_at` tombstones on client-cached tables. |
| 6 | Slug renames 404 indexed URLs. | `slug_redirect` + 301 middleware. |
| 7 | Nightly materializer in Supabase Edge Functions (Deno, wall-clock limits, no workspace imports). | Node `jobs/` worker (GitHub Actions cron / Fly) importing `packages/domain`; Edge Functions for request-path webhooks only. |
| 8 | i18n undecided. | Decide now: English at root, `/{locale}/` prefix later, `*_i18n` tables; keep `name/summary` out of unique constraints. |

Reviewer B also found the v1 DDL **does not execute** (`window` is a reserved word). v2's full schema (31 tables) and the core RPC query were executed against PostGIS 16 / 3.4 during this synthesis and compile cleanly.

## 3. Lens-specific required changes (adopted in v2)

**A — SEO / monetization / product**
- The schema could not store what Google ranks: added `phenomenon_place` editorial layer (`description_md`, `how_to_see_md`, `best_vantage_md`, `ethics_md`, `faq`, `reviewed_at`), `place.description_md`, and a `landing_page` control-plane table (slug resolution, `indexable`, canonical, `lastmod`). Publishing gate: ≥300 words pair-specific text + ≥1 occurrence in 24 months + ≥1 source, else `noindex`.
- `/place/{slug}/{month}` only when ≥3 occurrences overlap; `/event/{slug}` for one-off astronomy; `/place/{country}`, `/calendar/{month}`, `/family/{x}` hubs; no years in URLs; explicit `noindex` list.
- Structured data corrected: `Event` only for cultural fixed-date festivals and one-off astronomy (seasons are not Events); no `Product/Offer` on affiliate cards; `TouristAttraction/Trip` earn no SERP feature.
- Affiliate model could log clicks but not prove revenue: added `provider`, `supplier`, `place_external_ref` (Viator/GYG destination IDs), `offer_phenomenon` (many-to-many), `conversion` (partner-report reconciliation keyed by first-party `click_id`), `fx_rate`, minor-unit money, offer card fields (rating, duration, image, freshness), `/go/{click_id}` redirect on our domain with `rel="sponsored"`, reserved `booking` and `offer_availability` for the marketplace.
- Ranking: drop the monetization term (EU UCPD Art. 7(4a) disclosure obligation), add `spectacle`/`rarity` prior, feasibility gate, per-family diversity cap, explicit `peakProximity` decay, explainable cards, "Sky tonight" module for global astronomy.
- Product: `trip_item`, `profile`, `save` keyed per place, three-tier Explore (never empty), destination-first seeding, `event` analytics table for impressions.
- Don't share UI primitives (Tamagui) between SEO pages and the app; share `domain`, `api`, tokens.

**B — data / geo / ops**
- `rule.version` + `rule_materialization(rule_id, season_year, versions, inputs_hash)` → incremental, idempotent, auditable regeneration; `is distinct from` upserts to avoid GiST bloat.
- Rule kinds: add `rrule` (RFC 5545 — nth-weekday, weekly-in-season) and `override` (admin corrections that survive regeneration); `lunar` narrowed to computable calendars (Hindu/regional → `explicit` from a sourced table); `astronomical` adds `tide`, `aurora_season`.
- `seasonal_band` gets `peakDoy/halfWidthDays/peakSigmaDays`, an optional lat/elevation **gradient** (one region rule → blossom/foliage fronts), explicit `hemisphere` (never auto-flip).
- `confidence` numeric 0–1 (an enum can't be tuned by reports); `granularity day|instant`; exclusion constraint against overlapping windows per rule/place; `peak <@ during` check.
- `place`: `st_pointonsurface` centroid (true centroid of Chile/Norway is outside), `bbox`, `ltree path` for breadcrumbs (roll-ups are spatial), `geomag_lat`, `elevation_m`.
- Core query behind `security invoker` RPCs (`explore/plan/map_cells`); direct `select` on `occurrence` revoked for `anon`; rank in SQL on the candidate set; cap radius × horizon; keyset pagination; quantized Explore cache key.
- Offline: `(geohash-3 cell, quarter)` bundles in Storage + manifest; `expo-sqlite` mirror; outbox for user writes; no PowerSync/Watermelon in v1.
- RLS: `(select auth.uid())` wrapping, shared trips via `security definer` RPC, `device` table for push tokens.

## 4. Where the reviewers differed (and how v2 resolves it)

| Topic | A | B | v2 |
|---|---|---|---|
| Affiliate redirect location | Next.js route handler on own domain (ITP treats cross-domain bounce tracking harshly) | Edge Function, HMAC-signed, deduped | Next.js route handler **with** HMAC + `(anon_id, offer_id, day)` dedupe |
| Occurrence geometry | Add `geom`, keep `centroid` for pins | Replace `centroid` with `geom`; pins from `place.centroid` | B's version (pins come from `place.centroid`, generated) |
| Confidence type | Kept enum | Numeric 0–1 | Numeric (A had no objection; reports must tune it) |
| Astronomy in Explore | Separate capped "Sky tonight" module | `global` scope rows unioned into the query | Both: scope in schema, module in UI |

No contradictions on stack, indexes, identity, or the editorial gap.

## 5. Founder decisions before P0 (reviewer defaults in **bold**)

| # | Decision | Default | Source |
|---|---|---|---|
| 1 | Editorial capacity: who writes/reviews 300–500 words per indexable pair (1–3k pages)? | **LLM-drafted, human-reviewed, named editor; gate pages until reviewed** | A |
| 2 | Monetization in ranking | **Out of the score; disclosed re-ranker** | A |
| 3 | Global astronomy in Explore | **"Sky tonight" module, 1–2 cards** | A, B |
| 4 | Maps vendor | Mapbox (paid, offline packs, polished) **vs** MapLibre (OSS) — no default; decides the offline-map story | A |
| 5 | Rule source of truth | **Git YAML (`supabase/seed`) is canonical; Admin creates `override` rules only** | B |
| 6 | Confidence semantics: "how sure of the dates" vs "how likely to see it" | **Date certainty (what reports tune); UI copy says so** | B |
| 7 | Seed geography | **Top 50 destinations + 20 US parks + 10 wildlife/aurora circuits** (not top 50 countries) | A |
| 8 | i18n | **English at root, path-prefixed locales later, `*_i18n` tables** | A, B |
| 9 | Anonymous identity (device/anon id for clicks and pre-login saves) | **Yes** | B |
| 10 | Hijri/Hindu observances | **Hijri via Umm al-Qura ±1 day band; Hindu via sourced explicit tables** | B |
| 11 | Attribution reality: accept 30–60% un-attributable mobile clicks and 1–4 month revenue lag for the P5 go/no-go? | acknowledge | A |
| 12 | Affiliate applications submitted? Which API tier expected at zero traffic? | apply during P0 | A |

Adopting all defaults unblocks Phase 0 with the v2 schema as written. Decision 4 (maps) can be deferred to P1 without schema impact.
