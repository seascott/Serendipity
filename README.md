# Serendipity

Time + place travel companion: wildlife migrations, astronomical events, festivals and seasonal phenomena, surfaced by where you are (or will be) and when.

See [docs/DESIGN.md](docs/DESIGN.md) for the product and technical design. This repo is the P0 skeleton: monorepo, schema, ranking/materialize engine, and empty web/mobile shells.

## Layout

```
apps/web                Next.js App Router
apps/mobile             Expo / Expo Router
packages/domain         zod models, rankScore, materialize()
packages/api            Supabase client + explore() wrapper
packages/tokens         colors / spacing / type
jobs/                   Node materialize worker
supabase/migrations     v2 schema, RLS, explore() RPC
supabase/seed           YAML source of truth (empty until P1)
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
supabase start
supabase db lint
```

Copy `.env.example` to `apps/web/.env.local` after `supabase start` and fill in the printed URL and keys. Enable anonymous sign-in and email magic links in the local Auth settings.

## P0 materialize kinds

`packages/domain` implements `fixed_annual`, `rrule`, `explicit`, and `astronomical` (`moon_phase`, `equinox` as global instants). Golden files cover 2025–2027. Bump `ENGINE_VERSION` if output changes.

```bash
UPDATE_GOLDENS=1 pnpm --filter @serendipity/domain test
```
