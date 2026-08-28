# MPE database — not connected yet

There's no Supabase project for MPE yet (Kane's account is at its two-project
free-tier limit — see chat history). This directory holds the schema so it's
ready to go the moment a project exists; nothing here is applied anywhere.

## What's here

- `migrations/20260828000000_init.sql` — the full schema: `profiles`,
  `boilers`, `job_notes`, `bookings`, `stripe_customers`, `payments`, RLS
  policies for a single-admin setup (Fergal's account has `is_admin = true`,
  everyone else only sees their own rows), and an `avatars` storage bucket
  for profile/logo uploads.

## To connect it

1. Create a Supabase project for MPE (needs a free slot, or an upgrade).
2. `supabase link --project-ref <ref>`, then `supabase db push` — or paste
   the migration into the SQL editor.
3. Generate real TypeScript types from the live schema (don't hand-write
   them — they'll drift):
   `supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
4. In the app, search for `TODO(supabase)` — that's every stub function
   (`signUpStub`, `sendMessageStub`, etc.) shaped to become a real
   `@supabase/supabase-js` call with minimal changes.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   Vercel's project environment variables (and locally in `.env.local`).

Stripe is intentionally not wired into any of this yet — `stripe_customers`
and `payments` exist as tables only, ready for whenever that account is set
up.
