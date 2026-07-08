# PawSet

Emergency & care planning app for solo pet parents. Keep every pet's care
routine, medical details, and emergency contacts in one place — and share a
read-only care guide with sitters or emergency contacts via a secure link.

Built with Next.js (App Router), Supabase, Tailwind CSS, and shadcn/ui.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials
npm run dev
```

Apply the database schema in `supabase/migrations/0001_schema.sql` to your
Supabase project (SQL editor or `supabase db push`).

By default the app runs in demo mode (`BYPASS_AUTH=true`) so it starts with
zero configuration. Set `BYPASS_AUTH=false` to enable real Supabase auth.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npm run typecheck` — TypeScript check
