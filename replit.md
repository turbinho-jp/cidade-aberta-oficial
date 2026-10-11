# Cidade Aberta

Plataforma pública de participação cidadã, transparência municipal e gestão de demandas urbanas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, serves at /api)
- `pnpm --filter @workspace/cidade-aberta run dev` — run the frontend (port 21533, serves at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run migrate` — aplica as migrações versionadas (`lib/db/drizzle`); adota automaticamente bancos antigos criados com `push`
- `pnpm --filter @workspace/db run generate` — gera uma nova migração após alterar `lib/db/src/schema/` (depois commite `lib/db/drizzle`)
- `pnpm --filter @workspace/db run recount` — confere os contadores denormalizados contra as linhas reais (`-- --apply` para corrigir)
- `pnpm --filter @workspace/db run seed` — dados iniciais para banco novo (categorias, bairros de JP, secretarias; admin via `ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- `pnpm run build:vercel` — build de produção grátis (frontend estático + API em `api/index.mjs`); ver `DEPLOY.md`
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter router, TailwindCSS, Shadcn UI, react-leaflet (map), recharts (charts)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Cookie-based sessions (sha256 hash, signed cookies)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — DB schema files (one file per entity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/cidade-aberta/src/` — React frontend
- `artifacts/cidade-aberta/src/pages/` — Page components
- `artifacts/cidade-aberta/src/contexts/` — Auth context

## Architecture decisions

- Cookie-based auth with sha256 + salt (no bcrypt or JWT to keep it simple for first build)
- All demands, timeline, comments, and service orders are fully public (no auth required to read)
- Activity log table captures all significant events for the public feed
- Neighborhood/category demand counts are maintained via trigger-style updates on write
- Counters that derive from state (resolved per neighborhood/department, orders per team) are recomputed from the real rows inside the same transaction, with the parent row locked (`lib/counters.ts`); event counters (confirmations, comments, points) use guarded `+1`/`-1`
- Writes that touch several tables run in `db.transaction`; `logActivity` runs AFTER commit (it uses its own connection and `activity_log.demand_id` is a foreign key)
- Schema changes go through migrations only (never `drizzle-kit push`): edit the schema, run `generate`, review the SQL, commit, then `migrate`
- Leaflet (OpenStreetMap) for maps — no API key needed

- Fotos/anexos ficam no próprio Postgres (`attachments`, bytea), enviadas como corpo cru `image/*` (sem multipart/SDK). O navegador reduz a imagem; o servidor valida os bytes e remove EXIF de JPEG. Limites por env var (`MAX_ATTACHMENT_*`). `photoUrl` segue existindo só para registros antigos
- Produção grátis: Vercel (estático + Function `/api`, mesma origem) + Neon. CORS desligado por padrão (`CORS_ORIGIN` só se o frontend ficar em outro domínio)

## Product

Citizens can register problems in their neighborhood, confirm they also experience the same issue, comment on demands, and follow the public timeline as the city responds. Secretaries and admins can triage, create service orders, assign teams, and update statuses publicly. The dashboard shows live city health metrics. The map shows all demands with colored pins by status.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Rotas de envio de foto não estão no OpenAPI de propósito (o gerador não faz upload binário); o frontend usa `src/lib/attachments.ts`. Nunca selecione a coluna `attachments.data` em listagens
- Se `tsc --build` reclamar de `dist/index.d.ts` não construído, apague os `*.tsbuildinfo` (cache obsoleto)

- Never use `drizzle-kit push` on a database managed by migrations: it bypasses the history and the next `migrate` can fail or duplicate changes
- `confirmations` has a unique `(demand_id, user_id)`; foreign keys use RESTRICT for core references (category, neighborhood, author), CASCADE for children of a demand and SET NULL for optional references (department, team, activity feed)

- After any OpenAPI spec change, always run codegen before touching frontend or backend
- `react-leaflet` and `leaflet` must be installed in cidade-aberta package (not in workspace root)
- The 401 from `/api/auth/me` on page load is expected for unauthenticated users

## Seed accounts

- Admin: `admin@cidadeaberta.gov.br` / `senha123`
- Secretary: `infra@prefeitura.gov.br` / `senha123`
- Citizens: `maria@email.com`, `joao@email.com`, `ana@email.com`, `carlos@email.com` / `senha123`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
