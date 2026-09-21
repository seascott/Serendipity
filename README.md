# Serendipity

Time + place travel companion: wildlife migrations, astronomical events, festivals and seasonal phenomena, surfaced by where you are (or will be) and when.

See [docs/DESIGN.md](docs/DESIGN.md) for the product and technical design. This repo is the P0 skeleton: monorepo, schema, ranking/materialize engine, and empty web/mobile shells.

## Layout

```
apps/web                Next.js App Router
apps/mobile             Expo / Expo Router
packages/domain         zod models, rankScore, materialize()
packages/api            Supabase client + explore() wrapper (`/core` is React-free)
packages/catalog        Typed catalog (Git source of truth) + in-memory Plan/Explore demo
packages/tokens         colors / spacing / type
jobs/                   Node workers: materialize, seed:sql, smoke
supabase/migrations     v2 schema, RLS, explore() RPC
supabase/seed           catalog.sql generated from packages/catalog (do not edit)
```

## Local setup

```bash
corepack enable
pnpm install
pnpm test
pnpm typecheck
```

Web (no live catalog until a local Supabase project is running):

```bash
pnpm --filter @serendipity/web dev
```

Mobile:

```bash
pnpm --filter @serendipity/mobile dev
```

Database (requires Docker + the [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase start          # applies migrations, then loads supabase/seed/catalog.sql
supabase db lint
```

The seed is rendered from `packages/catalog` (places, phenomena, rules, and the
occurrences the engine materializes from them). After editing the catalog:

```bash
pnpm --filter @serendipity/jobs seed:sql          # regenerate supabase/seed/catalog.sql
pnpm --filter @serendipity/jobs seed:sql --check  # CI: fail if the committed seed is stale
supabase db reset                                 # reload locally
```

End-to-end smoke (anon `explore()` + `rank_score()` RPCs against the seeded DB;
asserts SQL scores equal TypeScript `rankScore` for every row) — also run in CI:

```bash
eval "$(supabase status -o env)"
SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY pnpm --filter @serendipity/jobs smoke
```

Copy `.env.example` to `apps/web/.env.local` after `supabase start` and fill in the printed URL and keys. Enable anonymous sign-in and email magic links in the local Auth settings.

## P0 materialize kinds

`packages/domain` implements `fixed_annual`, `rrule`, `explicit`, and `astronomical` (`moon_phase`, `equinox` as global instants). Golden files cover 2025–2027. Bump `ENGINE_VERSION` if output changes.

```bash
UPDATE_GOLDENS=1 pnpm --filter @serendipity/domain test
```
