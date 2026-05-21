# EduWeb

A classroom management platform where teachers create classes, post assignments, and grade submissions — and students join classes, submit work, and track their grades.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/eduweb run dev` — run the frontend (port 22841)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- Required env: `SESSION_SECRET` — session signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + express-session + bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + Wouter + Tailwind CSS + shadcn/ui
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM schema (users, classes, assignments, submissions)
- `lib/api-client-react/src/generated/` — generated React Query hooks (run codegen to update)
- `lib/api-zod/src/generated/` — generated Zod schemas (run codegen to update)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth / requireTeacher middleware
- `artifacts/eduweb/src/pages/` — React page components
- `artifacts/eduweb/src/components/layout.tsx` — main app sidebar layout
- `artifacts/eduweb/src/lib/auth.tsx` — AuthProvider and useAuth hook

## Architecture decisions

- Session-based auth (express-session + bcryptjs) — simple and works without JWTs
- OpenAPI-first: spec drives codegen for both Zod validators (server) and React Query hooks (client)
- Teachers and students are differentiated by `role` field on the `users` table
- Class membership uses a separate `class_enrollments` join table
- Invite codes (8 hex chars) let students join classes without teacher approval

## Product

- **Teachers**: create classes (get an invite code), post assignments with due dates, view all student submissions, grade and give feedback
- **Students**: join classes via invite code, submit answers to assignments, see their grades/feedback
- **Dashboard**: both roles see an overview card with counts (classes, assignments, submissions, pending)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run codegen after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` is idempotent — safe to run multiple times
- The API server bundles with esbuild; restart the workflow after code changes
- Do NOT run `pnpm dev` at workspace root — each artifact has its own workflow

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
