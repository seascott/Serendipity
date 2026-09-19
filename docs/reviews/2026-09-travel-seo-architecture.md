# Serendipity — Independent Review (travel product / SEO / monetization / web+mobile architecture)

Reviewed: `docs/DESIGN.md` @ `main` (commit `10b7bab`), seascott/serendipity. Review-only; no changes made to the repo.

Labels used throughout: **[Fact]** = verifiable, well-documented behaviour of a platform/partner/Google; **[Verify]** = my recollection of a partner/vendor detail that you must confirm against the current terms before relying on it; **[Opinion]** = my judgement from building/operating products in this category.

---

## 1. Verdict: **Confirm with changes**

The concept is sound and the stack choice is correct for the stated goals. The document is, however, a *platform* design, not yet a *product that earns money from organic search* design. Three things must change before you lock the schema and start P0:

1. **The schema cannot store the thing Google will rank.** There is no per-(phenomenon × place) editorial content, no place description, no landing-page entity, and the `occurrence` primary key (`{phenomenon}_{place}_{year}`) collides for phenomena that occur more than once per calendar year (king tides, Ramadan in 2030, bioluminescence, multiple aurora windows). Section 6 lists the required table/column changes.
2. **The affiliate model records clicks but cannot prove revenue.** There is no conversion/reconciliation table, no click ID passed to the partner, no provider↔place mapping, no supplier entity, offers are 1:1 with a phenomenon, and money is a bare `numeric`. As written you will *not* be able to "prove conversion per phenomenon/place before building the marketplace" — the very reason `affiliate_click` exists.
3. **The core geo query is wrong for non-point places.** `st_dwithin(o.centroid, …)` with a centroid for a coastline/region/country will make the "nothing near me" empty-state problem *worse*, not better (user in Sydney vs. "humpback migration, east coast Australia" whose centroid is offshore or inland). Store and index the geometry on `occurrence`, not only the centroid.

None of these are exotic; all are cheap now and expensive after P1 seeds and P2 URLs exist.

---

## 2. Stack decision

### Verdict: Next.js (web) + Expo/RN (mobile) + Supabase (Postgres/PostGIS) — **confirmed**, with four amendments.

**Why Flutter + Firebase is correctly rejected**

- **[Fact]** Flutter web renders through CanvasKit/Skwasm; the legacy HTML renderer is deprecated (Flutter 3.29 deprecation notice) and even it produced non-semantic DOM. There is no SSR/SSG story. An SEO-acquired product cannot ship its landing pages this way. The design's reasoning here is right.
- **[Fact]** Firestore has no native "geo radius ∩ date range ∩ facets" query. Geohash prefix scans plus client-side filtering, or an external index (Typesense/Algolia), is the standard workaround; range filters on two different fields in one query are constrained. PostGIS `geography` + `tstzrange` GiST indexes do it in one indexed statement. Correct.
- **[Fact]** Firestore is a document store; the catalog is relational (phenomenon ↔ place ↔ rule ↔ source ↔ offer ↔ occurrence). Correct.
- **[Opinion]** The usual counter-argument — "team velocity in Flutter" — is real but is a mobile-only argument. The web tier decides the business (acquisition + affiliate revenue happens on the web first; the app is retention). So the web tier's requirements dominate the stack choice.

**The hybrid (Flutter mobile + Next.js web + Supabase) is a legitimate fallback and you should keep it open at zero cost**

- `supabase_flutter` is a first-class client. The hybrid only hurts if domain logic (rule → occurrence, ranking) lives in the client. **Amendment 1:** keep `materialize()` and `rank_score()` *server-side* (SQL/PL/pgSQL or a Node job writing to Postgres), and treat `packages/domain` in the clients as *types + formatting + zod validation*, not as the source of truth. That keeps the "revisit if RN velocity disappoints" escape hatch genuinely cheap, and it's the right architecture anyway (mobile clients shouldn't recompute eclipse paths).

**Real risks with the recommended stack (name them in ADRs now)**

| Risk | Status | Mitigation |
|---|---|---|
| **Maps** — `react-native-maps` does not run on web; the web map must be a second implementation (MapLibre GL JS / Mapbox GL JS / Google Maps JS). Clustering + a time scrubber re-filtering hundreds of pins is where RN maps get janky. **[Fact]** | Two map implementations regardless of UI-sharing ambitions | Pick one vector-tile vendor for both: `@rnmapbox/maps` + Mapbox GL JS, or MapLibre native + MapLibre GL JS (OSS, no per-load cost). Both support **offline tile packs**, which `react-native-maps` (Apple/Google Maps) does not — and offline maps in parks is in your v1 (§4.3). Do server-side clustering (PostGIS `ST_ClusterDBSCAN` or supercluster in an RPC) for the scrubber, not client-side over the full set. |
| **Offline** — "occurrence bundle JSON + thumbnails" gives an Explore list offline but a **blank map** offline unless tiles are packed. **[Fact]** | Underspecified | Decide vendor per row above; scope offline map packs to trip-leg bounding boxes. |
| **Expo** — Mapbox/MapLibre need a custom dev client (not Expo Go); RN New Architecture is default since SDK 52 and some libraries lag; SDK majors ~3×/year force upgrades. **[Fact]** | Manageable | EAS dev client from day 1; pin SDK; upgrade once per quarter. |
| **Shared UI (Tamagui)** — heavy compiler config, frequent breaking changes; more importantly, **SEO pages need semantic HTML** (`<article>`, `<h1>`, `<table>`, `<time>`), not `View`/`Text` compiled to `div` soup. **[Opinion, widely shared]** | The design pulls in the wrong direction | **Amendment 2:** do *not* share UI primitives between SEO landing pages and the app. Share `domain`, `api`, design *tokens* (colors/spacing as JSON) and icons. Build landing pages in plain React + CSS (Tailwind is fine). Reconsider Tamagui only for in-app screens that must exist on both web and mobile (Plan, Trip). |
| **Supabase Edge Functions run on Deno**, so importing your Turborepo `packages/*` from `supabase/functions/*` is friction (npm specifiers work, workspace packages don't cleanly). Wall-clock and memory limits are tight for a nightly job that materializes 3 years × thousands of pairs. **[Fact; check current limits]** | Design puts `materialize`, `ingest/*`, `alerts` there | **Amendment 3:** run batch jobs as Node (GitHub Actions cron, Vercel cron, or a tiny Fly/Railway worker) that imports `packages/domain` directly and writes via the service-role key. Keep Edge Functions for request-path things (webhooks). Use `pg_cron` for pure-SQL maintenance only. |
| **Supabase platform limits** — free tier pauses after inactivity (unusable for a public site); PostgREST default 1,000-row cap; RLS performance pitfalls (`auth.uid()` in policies must be wrapped in `(select auth.uid())` and policy columns indexed); Postgres full-text with `'simple'` is English/ASCII only. **[Fact for the first three; verify current pricing]** | Fine at your scale | Pro plan from launch; catalog read via `anon` role; put geo queries behind `rpc()` functions (PostgREST can't express `st_dwithin` params otherwise). |
| **Affiliate redirect through a Supabase Edge Function** adds a cross-origin hop, cold-start latency, and a second domain in the redirect chain (Safari ITP treats bounce-tracking domains harshly **[Fact]**). | Design §4.1 | **Amendment 4:** do the `/go/{click_id}` redirect in a Next.js route handler on your own domain; write the click row asynchronously. Mobile calls the same endpoint then opens the browser. |
| Vercel: Hobby tier is non-commercial; ISR writes/edge requests are metered. **[Fact]** | Minor | Pro plan; cache aggressively. |

Net: the recommended stack's risks are execution risks, not category risks. Flutter+Firebase has a category risk (no indexable web). Confirm.

---

## 3. SEO architecture

### 3.1 What is right
- The money query is "when/best time to see {phenomenon} in {place}". `/when-to-see/{phenomenon}-in-{place}` matches the head-term shape. Good.
- SSG/ISR on Next.js App Router is the right rendering model for a catalog that changes nightly.
- Deciding to treat landing pages as first-class surfaces (not a blog bolted on) is right.

### 3.2 What will fail as designed

**(a) Thin content is a schema problem, not a copywriting problem.** The only prose in the schema is `phenomenon.description_md` (global, not per place). `place` has no description at all. So every `/when-to-see/gray-whales-in-baja` page can only render: a window, a confidence badge, a band chart, and 3 Viator cards. **[Fact]** Google's *scaled content abuse* spam policy (March 2024) and the helpful-content signals folded into core ranking explicitly target "many pages generated primarily to manipulate rankings, with little value", regardless of whether they were produced by humans, templates or LLMs; travel/affiliate template sites were among the most visibly hit in 2024. **[Opinion]** A new domain publishing thousands of templated pages with no unique text will mostly sit in "Crawled – currently not indexed."

Required: a per-pair editorial layer (`phenomenon_place` — see §6) with `description_md`, `how_to_see_md`, `faq jsonb`, `reviewed_by`, `reviewed_at`, and a `place.description_md`. Then a hard publishing gate: **a page is indexable only if it has (i) ≥ ~300 words of original pair-specific text, (ii) at least one dated occurrence within the next 24 months, and (iii) ≥1 cited `source`.** Everything else is `noindex` or not generated. At 300 seed phenomena you'll have perhaps 1–3k indexable pair pages at launch — that is *not* a programmatic-SEO scale problem; it's a small, high-quality catalog, which is exactly what ranks for a new domain.

**(b) `/place/{slug}/{month}` is the highest-risk page type.** `places × 12` explodes combinatorially, most cells are empty in a thin catalog, and "Kyoto in April" competes with Lonely Planet, weather sites and every tourism board. **[Opinion]** Generate a place×month page only when ≥3 occurrences overlap that month at that place (or its children), otherwise 404/redirect to `/place/{slug}`. Position it as *"what's happening in Kyoto in April"* (events/phenomena), never as a generic destination guide.

**(c) Slug parsing of `{phenomenon}-in-{place}` is ambiguous.** Places and phenomena containing `-in-` (e.g. "lake-in-the-hills", "sunrise-in-the-desert") break a split-on-`-in-`. Don't parse; **resolve the full slug against a `landing_page` table** (§6). This also gives you a home for `noindex`, `canonical`, `lastmod`, and slug history.

**(d) No slug history → broken URLs on rename.** `slug text unique` on `place`/`phenomenon` with no redirect table means every rename 404s indexed URLs. Add `slug_redirect(old_slug, entity, entity_id)` and 301 in middleware.

**(e) ISR + relative time.** "peaks in 9 days" rendered at build time is stale in cache. Render **absolute dates** server-side (`<time datetime>`), compute relative phrasing client-side. Set `revalidate` ≈ 24h and call `revalidateTag('lp:<landing_page.id>')` from the nightly materialize job when a window changes; `generateStaticParams` only the top N (say 500) pages at build, `dynamicParams = true` for the tail.

**(f) Canonicals/noindex.** `/place/{slug}?from=&to=` must canonicalize to `/place/{slug}` (or the month page); `/explore?lat=&lng=`, `/trip/{token}`, `/go/*`, admin, and any faceted URL must be `noindex` and disallowed in `robots.txt`. This is not mentioned anywhere in the doc.

### 3.3 Structured data — correct the plan
- **[Fact]** Google's Event rich-result guidelines require a real event with a specific date and location and warn against marking up non-events. A festival with fixed dates (`fixed_annual`/`explicit`/`lunar` cultural rules) is a legitimate `Event`. "Whale season", "peak foliage" or "aurora season" is **not** an Event; marking those up invites a manual action. Use `Event` only for `family = cultural` (and one-off astronomy such as a specific eclipse) with a specific `startDate`/`endDate`, `location` (Place with `geo`), and `eventStatus`.
- **[Fact]** Google has **no rich result** for `TouristAttraction`, `TouristDestination`, `TouristTrip` or `Trip`. Emitting them is harmless and helps entity understanding, but don't plan on SERP features from them.
- **[Fact]** FAQ rich results were restricted (Aug 2023) to authoritative government/health sites; HowTo rich results were removed. Keep `FAQPage` markup for entity clarity if you like, but the FAQ *content* is what matters (it targets People-Also-Ask queries).
- **[Fact]** `Product`/`Offer` merchant markup is for pages where the product is sold; affiliate tour cards should not carry it.
- Do emit: `BreadcrumbList`, `Article` (with `author`, `dateModified`, `citation`), `Place`/`geo`, `ImageObject` with license, `Organization`, and `Dataset` for your annual peak-calendar export (real link-earning asset).
- **[Fact]** Outbound affiliate links should carry `rel="sponsored"` (Google's stated guidance for paid/affiliate links).

### 3.4 Internal linking and hubs — add page types
The graph is phenomenon ↔ place ↔ month ↔ family ↔ region. Required hubs so no landing page is an orphan and everything is ≤3 clicks from home:
- `/p/{slug}` should *be* the global "when & where to see X" page (best places, 12-month band chart, next 3 dated occurrences). This is a high-volume head term ("Perseids 2026", "when is cherry blossom season").
- `/event/{slug}` for one-off astronomy (e.g. `total-solar-eclipse-2026-08-12`): dated, `Event`-eligible, huge spike traffic, legit `Event` markup.
- `/place/{country}` and `/place/{region}` hubs (via `place.parent_id`); `/calendar/{month}` ("what's happening in the world in April"); `/family/{wildlife}`.
- Modules on every pair page: "same phenomenon elsewhere", "same place, other months", "nearby this month", breadcrumbs, and a "sources & last verified" block (E-E-A-T).
- **[Opinion]** `/p/` vs `/phenomenon/` makes no ranking difference; keep `/p/` for brevity and shareability.

### 3.5 Years in URLs
**[Opinion]** Don't. Keep evergreen URLs and update content each year with explicit "2026 dates" and "2027 dates" sections; year-in-URL splits authority and creates annual orphan pages. Exception: `/event/` one-offs, which are genuinely dated.

### 3.6 Sitemap & discovery
- **[Fact]** 50,000 URLs / 50 MB per sitemap file; use Next.js `generateSitemaps` to shard by page type with `lastmod` from `landing_page.updated_at`. Only include indexable pages.
- **[Fact]** Google's Indexing API only covers `JobPosting`/`BroadcastEvent`; not applicable. Bing **IndexNow** is free and applicable — ping on every revalidate.
- New-domain reality **[Opinion from experience]**: expect 6–12 months before non-trivial organic traffic even with perfect execution. Plan link-earning assets from P2: an embeddable band chart per phenomenon, `.ics` calendars per phenomenon/place, an annual "Global Peak Calendar" dataset, and Pinterest/Reddit/Discover-friendly imagery. Don't put all acquisition on Google.

### 3.7 i18n (decide now, build later)
A global catalog will want `/es/`, `/de/`, `/ja/` within two years. Decide **now** that English is at root and locales are path-prefixed, and that `name/summary/description_md` will move to a `*_i18n(entity_id, locale, …)` table. Costs nothing today; saves a URL migration later.

---

## 4. Monetization

### 4.1 What's missing to actually earn commissions

**Partner realities (verify each against current terms):**
- **Viator** **[Verify]**: affiliate links carry `pid`, `mcid`, `medium` and optionally a `campaign` sub-ID; the Partner API "Basic-access Affiliate" tier exposes product search/details for approved affiliates and imposes content-caching and freshness rules for prices/availability; commission is confirmed **after the travel date**, not at booking, and cancellations claw back. Cookie window ~30 days.
- **GetYourGuide** **[Verify]**: `partner_id` plus a `cmp` campaign parameter for sub-tracking; Partner API access is gated (many small partners get widgets/deep links only); commission paid after the activity takes place; ~31-day cookie.
- **Booking.com** **[Verify]**: `aid` plus a free-text `label` for sub-tracking; attribution is effectively **session-based** (no meaningful cookie window); payout after checkout with a minimum threshold; the programme has become more selective for small publishers and increasingly runs via networks (CJ/Awin). Do not model lodging as reliable P1 revenue.
- **Expedia Group** **[Verify]**: affiliate programme via Partnerize; deep links only for new partners.
- **[Fact]** Safari ITP and Firefox ETP shorten or strip tracking cookies set via cross-site redirect chains; effective attribution windows on iOS are materially shorter than partner-stated windows. Your mobile clicks are mostly iOS. Expect under-attribution; keep a first-party `click_id` in the partner sub-ID so *their* reports, not cookies, are your source of truth.

**Consequences for the design:**
1. **Conversion lag:** commissions confirm weeks to months after click. "Prove conversion per phenomenon/place before building the marketplace" needs a `conversion` table fed by partner reports (CSV/API) keyed by your `click_id`, with status (`pending`/`confirmed`/`cancelled`/`paid`), gross booking value, commission, currency, travel date, payout date. Without it, `affiliate_click` is vanity data.
2. **Click identity:** `affiliate_click` needs a public `click_id` (short, non-sequential — don't expose `bigserial`), `session_id` for anonymous users (most clicks), `provider`, `place_id`, `phenomenon_id`, `landing_page_id`/`surface`, `device`, `country`, `referrer`, `experiment_variant`. The click_id must be embedded in the outbound URL sub-ID (`campaign`/`cmp`/`label`).
3. **Offers are many-to-many:** a Baja whale-watch tour applies to gray, humpback and blue whales; a Kyoto walking tour applies to blossoms *and* Gion Matsuri. `booking_offer.phenomenon_id` (single) forces duplicates. Use `offer_phenomenon` (and optionally `offer_occurrence` for date-bound inventory later).
4. **Provider place mapping:** Viator/GYG organise products by *destination IDs*, not coordinates **[Fact]**. You need `place_external_ref(place_id, provider, external_id, kind)` to look up "tours near this place". Without it, offer ingestion (P4) has nowhere to land.
5. **Supplier entity now:** partner APIs return a supplier/operator name. Store `supplier(id, name, provider, external_id, place_id)` and `booking_offer.supplier_id`. This is the seed list for marketplace onboarding (P5): you'll already know which operators convert, per phenomenon.
6. **Offer card fields:** `price_from_minor int`, `currency`, `price_as_of timestamptz`, `rating numeric(2,1)`, `review_count int`, `duration_minutes`, `image_url`, `supplier_id`, `cancellation_policy text`. A tour card without rating/duration/photo converts poorly **[Opinion]**, and partner display rules often require the "from" qualifier and freshness.
7. **Money:** never bare `numeric` with a single currency. Integer minor units + ISO currency + `as_of`; a daily `fx_rate(base, quote, rate, as_of)` table for display conversion; display currency from user locale, pass `currency=` to partners where supported **[Verify]**.
8. **Disclosure & law:**
   - **[Fact]** US FTC Endorsement Guides (16 CFR 255): affiliate relationships must be disclosed clearly and conspicuously, near the link, on web *and* in-app. UK CMA/ASA and EU UCPD have equivalent rules.
   - **[Fact]** EU Omnibus Directive (in force 2022) amends UCPD Art. 7(4a): online search results must disclose main ranking parameters and must flag any paid/commission-influenced ranking. Your `w5 * hasBookableOffer` term is exactly that. Either drop it from the ranking, or expose it as a labelled, explainable parameter ("bookable experiences shown first") and keep an "Explain this ranking" affordance. My recommendation: **remove w5 from score; apply monetization as a tie-breaker/re-ranker with disclosure.**
   - **[Fact]** Apple App Store Review 3.1.3(e)/3.1.1: bookings for real-world services consumed outside the app may use external payment; opening a partner site in-app (SFSafariViewController / Custom Tabs) is fine. Prefer the in-app browser (keeps the user; conversion is higher) but accept attribution loss if they return to Safari later.
9. **Redirect:** `/go/{click_id}` on your domain (Next route handler), 302, `noindex`, `robots` disallowed, `rel="sponsored"` on the anchor, click row written async.
10. **Analytics funnel:** you need *impressions* of offer cards, not just clicks, to compute CTR per surface and tune ranking. Add an `event` stream (an append-only Postgres table or a hosted product-analytics tool such as PostHog) from P1.

### 4.2 Marketplace-later: what to lay down now to avoid a rewrite
- `provider` as a table (`id`, `kind: 'affiliate'|'marketplace'`, `tracking_template`, `attribution_window_days`, `commission_pct`, `terms_url`) rather than a free-text column. Adding `'own'` later is then a row, not a migration.
- `supplier` + `place_external_ref` (above).
- `offer` (what is sold) separate from `offer_availability` (when; date-bound inventory) — create the second table empty now or at least reserve the name; do **not** put dates on `booking_offer`.
- `booking(id, user_id, offer_id, occurrence_id, provider_id, status, gross_minor, currency, commission_minor, click_id)` — for affiliates it's populated from reconciliation; for marketplace it's populated by Stripe webhooks. One table, one funnel.
- Money and timezones as above. Stripe Connect itself can wait.

---

## 5. Product

### 5.1 Explore ranking
The additive formula is a reasonable v0 but has known failure modes **[Opinion]**:
- **Astronomy floods the feed.** "Always something everywhere" means the top 10 in most places will be moon phases and meteor showers. Treat `place.kind = 'global'` occurrences as a separate **"Sky tonight"** module, capped at 1–2 cards, not as competitors in the main list.
- **No spectacle/rarity prior.** A total eclipse and a lavender field must not score alike. Add `phenomenon.spectacle smallint` (editorial 1–5) and `rarity` (derived from cadence).
- **No diversity.** Apply a per-family cap or MMR so the list isn't five meteor showers.
- **Distance term goes negative outside the radius** and ignores travel time/feasibility (boat needed, dark sky needed, permits). Use travel-time bands (drive-time isochrones later; great-circle × 1.4 now) and a `feasibility` gate.
- **Unspecified decay.** Define `peakProximity` explicitly (e.g. 1 inside peak, linear to 0 at window edge, then exponential beyond) so mobile and web agree; unit-test it in `packages/domain`.
- **Monetization inside the score** → see EU disclosure point; move it out.
- **Explainability:** each card should show *why* ("peak in 4 days · 45 min away · high confidence"). Log ranking features with impressions so weights can be tuned offline.

### 5.2 Empty state in a thin global catalog
This is the biggest product risk and the design underestimates it **[Opinion]**. Concrete changes:
- Fix the centroid-vs-geometry bug (§1, §6) — it is the single largest contributor to false "nothing near you".
- Seed *where users physically are*: top 50 destinations by visitor volume + top 20 US national parks + top 10 safari/whale/aurora circuits, rather than "top 50 countries".
- Define three tiers on Explore: **Nearby now** → **Worth a detour (≤ 300 km, next 30 days)** → **Coming up in this region (next 90 days)**. Never render an empty screen.
- In Plan mode, let the phenomenon-first path ("I want to see X") work globally with zero location — this is your strongest empty-state-proof surface.

### 5.3 Plan mode & trip model
- `trip_leg` needs `trip_item(id, trip_id, leg_id, occurrence_id, offer_id, status, position)` — "bookings per leg" and "shift dates shows what you gain/lose" both need items, not just legs.
- `save` is keyed on `(user, phenomenon)` but "remind me N days before peak" is per **occurrence** (and per place). Key `save` on `(user_id, phenomenon_id, place_id nullable)` or on `occurrence_id`.
- `interestMatch(user.interests)` has no storage: add `profile(user_id, interests family[], units, home_place_id, locale, currency)`.
- Timezones: `window tstzrange` + `place.timezone` is right; document that all windows are computed as local civil dates then converted, and that `explicit` rule windows are stored as local dates.
- Confidence UX: "peak ± variance" band rather than dates is correct and differentiating. Show *"based on N field reports"* when the report loop kicks in.

### 5.4 Data strategy
- Sound. One caution **[Verify]**: Viator/GYG availability calendars used to infer "operator seasons" are covered by API content terms — check that derived-data reuse is permitted before building the P4 ingest.
- eBird/GBIF/iNaturalist histogram fitting is a strong moat and a strong link-earning asset (publish the method).

---

## 6. Schema / data-model changes required before Phase 0

Concrete, table-level. Items 1–4 and 9 are *blocking*; the rest should land in P0 migrations as empty tables/columns.

1. **`occurrence` identity and geometry**
   - Replace `id text = {phenomenon_id}_{place_id}_{year}` with `id uuid` + `unique (phenomenon_id, place_id, lower(window))`, plus `rule_id uuid references rule(id)` (provenance; enables idempotent re-materialization and deletion of windows whose rule changed). **Evidence:** Ramadan begins twice in Gregorian 2030 (~Jan and ~Dec); king tides occur several times per year; bioluminescence and aurora have multiple windows.
   - Add `geom geography(geometry,4326) not null` (denormalized from `place.geom`), `create index … using gist (geom)`, and change the core query to `st_dwithin(o.geom, :here, :radius_m)` with `st_distance(o.geom, :here)` (0 when inside). Keep `centroid` for map pins only.
   - Add `materialized_at timestamptz`, `generation int`, and `year int` (query convenience).
   - The `window` GiST index alone is fine; a composite GiST on `(geom, window)` via `btree_gist` is optional.

2. **Editorial layer for landing pages**
   - `place`: add `description_md text`, `hero_image_id`, `updated_at`.
   - New `phenomenon_place (phenomenon_id, place_id, primary key(…), description_md, how_to_see_md, best_vantage_md, ethics_md, faq jsonb, hero_image_id, editor_id, reviewed_at, status)`.
   - New `landing_page (id uuid, slug text unique, kind text check (kind in ('phenomenon','place','place_month','pair','event','family','calendar_month')), phenomenon_id, place_id, month smallint, event_occurrence_id, indexable bool, canonical_slug text, title, meta_description, updated_at)`. Routing resolves the full slug here; sitemap and revalidation key off it.
   - New `slug_redirect (old_slug text primary key, entity text, entity_id uuid, created_at)`.

3. **Affiliate / commerce**
   - New `provider (id text primary key, kind text check (kind in ('affiliate','marketplace')), tracking_template text, attribution_window_days int, commission_pct numeric, terms_url text)`; `booking_offer.provider` → `provider_id references provider`.
   - New `supplier (id uuid, provider_id, external_id, name, place_id, unique(provider_id, external_id))`; `booking_offer.supplier_id`.
   - `booking_offer`: add `unique (provider_id, external_id)`; replace `price_from numeric` with `price_from_minor int`, keep `currency char(3)`, add `price_as_of timestamptz`, `rating numeric(2,1)`, `review_count int`, `duration_minutes int`, `image_url text`, `cancellation_policy text`, `updated_at`. Drop `phenomenon_id`.
   - New `offer_phenomenon (offer_id, phenomenon_id, primary key(…))`.
   - New `place_external_ref (place_id, provider_id, external_id, kind text, primary key(provider_id, external_id))`.
   - `affiliate_click`: add `click_id text unique` (short random), `session_id text`, `provider_id`, `place_id`, `phenomenon_id`, `landing_page_id`, `surface text`, `device text`, `country char(2)`, `referrer text`, `variant text`, `ip_hash text`. Keep `user_id` nullable.
   - New `conversion (id uuid, click_id text references affiliate_click(click_id), provider_id, provider_booking_ref text, status text check (status in ('pending','confirmed','cancelled','paid')), gross_minor int, commission_minor int, currency char(3), booked_at, travel_date date, paid_at, imported_at, raw jsonb, unique(provider_id, provider_booking_ref))`.
   - New `fx_rate (base char(3), quote char(3), rate numeric, as_of date, primary key(base, quote, as_of))`.
   - Reserve `booking` and `offer_availability` (create with minimal columns; see §4.2).

4. **Ranking inputs**
   - `phenomenon`: add `spectacle smallint check (1..5)`, `rarity smallint`, `feasibility jsonb` (e.g. `needs_dark_sky`, `needs_boat`, `permit_required`).
   - New `profile (user_id primary key, interests family[], units text, home_place_id, locale text, currency char(3))`.
   - New `config (key text primary key, value jsonb, updated_at)` — referenced in §5 of the design but not defined.

5. **Trips & saves**
   - New `trip_item (id, trip_id, leg_id, occurrence_id, offer_id, status, position)`.
   - `save`: change PK to `(user_id, phenomenon_id, place_id)` with `place_id` nullable, or add `occurrence_id`.

6. **Provenance**
   - `rule_source (rule_id, source_id)` in addition to `phenomenon_source` — the *window* is what needs citing on the page.
   - `source`: add `title text`, `publisher text`, `accessed_at date`.

7. **i18n readiness** — no tables yet, but name the future `phenomenon_i18n`/`place_i18n` in an ADR and keep `name/summary/description_md` out of any unique constraints.

8. **Auditing** — `created_at/updated_at` on every catalog table; `phenomenon.status` already exists — mirror it on `place` and `phenomenon_place`.

9. **Analytics** — an append-only `event (id bigserial, ts, session_id, user_id, name, props jsonb)` table or a hosted product-analytics tool wired in P1, so impressions → clicks → conversions is one funnel.

---

## 7. Nice-to-haves (not blocking)

- `.ics` feeds per phenomenon/place and per trip (cheap; strong retention + backlinks).
- Embeddable SVG band chart (`/embed/p/{slug}.svg`) with attribution link — a natural link-earning widget for bloggers and tourism boards.
- Annual "Global Peak Calendar" open dataset (CC-BY) with `Dataset` markup.
- Server-side clustering RPC for the map scrubber.
- Drive-time isochrones (Mapbox/OpenRouteService) for "worth a detour" instead of great-circle distance.
- Mapbox Static Images (or pre-rendered PNG) on landing pages instead of interactive maps (Core Web Vitals).
- `Dataset`/`Article` E-E-A-T block: named editor, credentials, method for confidence bands.
- IndexNow pings on revalidate.
- Consider the name check early (as the doc says); "Serendipity" is unbrandable in app-store search **[Opinion]**.

---

## 8. Open questions for the founder

1. **Editorial capacity:** who writes ~300–500 words per (phenomenon × place) pair for the first 1–3k pages, and who reviews LLM-drafted copy? The SEO plan is only as good as this answer.
2. **Affiliate approvals:** have Viator/GYG/Booking applications been submitted? Which API tier do you expect to be granted at zero traffic? (Deep-links-only changes what P1 can ship.)
3. **Attribution acceptance:** are you comfortable that ~30–60% of mobile clicks will be un-attributable due to ITP/session-based windows, and that revenue proof lags 1–4 months? This affects the P5 go/no-go timeline.
4. **Astronomy in Explore:** module ("Sky tonight") or full competitor in ranking? I recommend module.
5. **Maps vendor:** Mapbox (paid, polished, offline packs) vs MapLibre (OSS, more assembly)? This decides the offline story.
6. **Markets & languages:** English-only for how long? Which three locales are next? (Decides `/[locale]/` routing now.)
7. **Ranking transparency in the EU:** are you willing to drop the monetization term from the score in favour of a disclosed re-ranker?
8. **Hybrid fallback:** would you keep the Flutter option genuinely alive by keeping `materialize`/`rank_score` server-side, or commit fully to TS on both clients?
9. **Seed geography:** top 50 countries (design) vs top 50 *destinations + parks* (my recommendation) — which do you want for P1?
