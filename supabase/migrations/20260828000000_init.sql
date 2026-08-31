-- MPE data model: customer accounts, boilers, job notes, bookings and
-- payments. Not applied to any project yet — there's no Supabase project
-- for MPE at the time this was written (see README note below). Written so
-- it's ready to run the moment one exists.
--
-- To go live:
--   1. Create a Supabase project for MPE.
--   2. `supabase link --project-ref <ref>` then `supabase db push` (or
--      paste this file into the SQL editor).
--   3. Generate real TypeScript types from the live schema — don't
--      hand-write them, they'll drift:
--        supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
--   4. Swap the stub functions in src/app/**/page.tsx (signUpStub,
--      sendMessageStub, etc — search for TODO(supabase)) for real
--      @supabase/supabase-js calls.
--   5. Wire up Stripe separately once that account exists — see the
--      stripe_customers/payments tables below, which are deliberately
--      empty of any real integration for now.

-- ---------------------------------------------------------------------
-- profiles
-- One row per customer (and per admin — Fergal's own login), 1:1 with
-- auth.users. Doubles as "their account = a database about their boiler,
-- payments, info" per the brief: address and account-type fields live
-- directly on the profile since each customer has exactly one property
-- for now (a commercial customer with multiple sites is a later problem).
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null default 'home' check (account_type in ('home', 'commercial')),
  full_name text not null default '',
  company_name text,
  vat_number text,
  company_reg_number text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user (customer or admin), 1:1 with auth.users. is_admin gates the Fergal dashboard — see the single-admin decision in project notes.';

-- ---------------------------------------------------------------------
-- boilers
-- A customer can have more than one over time (they replace it) — is_current
-- flags which one is installed now so job notes/visits reference the right
-- unit without losing the history of what was there before.
-- ---------------------------------------------------------------------
create table public.boilers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  make text not null,
  model text,
  installed_year int,
  is_current boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boilers_profile_id_idx on public.boilers (profile_id);

-- ---------------------------------------------------------------------
-- job_notes
-- What Fergal writes up after a visit — customer-visible so they (or a
-- different engineer next time) can see exactly what was done.
-- Customers can read their own notes but never write or edit them.
-- ---------------------------------------------------------------------
create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  boiler_id uuid references public.boilers (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  visit_date date not null default current_date,
  note text not null,
  created_at timestamptz not null default now()
);

create index job_notes_profile_id_idx on public.job_notes (profile_id);

-- ---------------------------------------------------------------------
-- bookings
-- Every contact-form / "book a callout" submission. profile_id is nullable
-- because most bookings start as a guest (no account yet) — the contact
-- page then offers to create one. If they do, a later step should backfill
-- profile_id on their most recent booking by matching email/phone.
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  message text not null,
  -- Ticked on the contact form — purely a customer-reassurance signal
  -- ("this feels like it'll get a fast response"), not a guarantee. Lets
  -- Fergal see at a glance which bookings are asking for urgency.
  same_day_requested boolean not null default false,
  -- 'answered' covers a plain question Fergal replied to by email and
  -- closed out without it ever becoming a job — distinct from
  -- 'cancelled', which is a job that fell through.
  status text not null default 'new'
    check (status in ('new', 'answered', 'confirmed', 'completed', 'cancelled')),
  -- How the enquiry came in. 'form' for the online contact form; the
  -- others are set when Fergal adds a job himself from a call/WhatsApp/
  -- email he took directly — see "Add job manually" in the admin.
  source text not null default 'form' check (source in ('form', 'phone', 'whatsapp', 'email')),
  -- Set together when Fergal hits "Confirm callout" in the admin: the
  -- agreed date/time window, sent to the customer along with the £50
  -- confirm-and-save-card payment link. Null until then. Same fields get
  -- updated (and a rescheduled email sent) if the date changes later.
  callout_date date,
  callout_time_window text,
  created_at timestamptz not null default now()
);

create index bookings_profile_id_idx on public.bookings (profile_id);

-- ---------------------------------------------------------------------
-- stripe_customers
-- Deliberately its own table, separate from payments, and left empty of
-- any real Stripe wiring — populated only once a Stripe account exists.
-- One row per profile once they've saved a card.
-- ---------------------------------------------------------------------
create table public.stripe_customers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null,
  card_brand text,
  card_last4 text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- payments
-- The £50 call-out (and anything else charged). method distinguishes a
-- charge on the saved card from tap-to-pay/cash taken on the day — both
-- get logged here either way so Fergal has one payment history per
-- customer, even for payments Stripe never touched.
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- Nullable on purpose: a webhook payment that can't be matched to a
  -- known customer (a bare tap-to-pay with no customer picked in the
  -- Stripe app, or a Stripe customer this database has no mapping for)
  -- still gets a row — it shows in the admin's "Unmatched payments"
  -- section until Fergal assigns it, rather than silently vanishing.
  profile_id uuid references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  stripe_payment_intent_id text,
  -- The raw customer from the payment intent, kept even when it didn't
  -- match a profile: assigning the payment in the admin can then also
  -- backfill stripe_customers with the mapping, so that customer's next
  -- payment matches automatically.
  stripe_customer_id text,
  amount_pence int not null,
  currency text not null default 'gbp',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  -- card_on_file: charged from admin using the saved card (deposit or
  -- final invoice). invoice_link: customer paid a Stripe-hosted invoice
  -- emailed to them. tap_to_pay: taken in person via the Stripe app
  -- directly — logged here for the record, but the charge itself never
  -- touches this codebase. other: cash/bank transfer etc.
  method text check (method in ('card_on_file', 'invoice_link', 'tap_to_pay', 'other')),
  receipt_emailed boolean not null default false,
  -- Set true by the Stripe webhook (src/app/api/stripe-webhook/route.ts)
  -- when a payment arrives from outside this codebase (tap-to-pay in the
  -- Stripe app). Drives the "add job notes for future engineers" prompt
  -- in /admin/callouts; cleared when Fergal saves the notes.
  needs_notes boolean not null default false,
  created_at timestamptz not null default now()
);

create index payments_profile_id_idx on public.payments (profile_id);

-- Partial unique index so the webhook's insert can be an idempotent
-- upsert on the intent id — Stripe retries deliveries, and the same
-- payment must never create two rows. Partial because rows logged by
-- hand (cash, tap-to-pay recorded manually) have no intent id.
create unique index payments_stripe_payment_intent_id_key
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- ---------------------------------------------------------------------
-- is_admin() helper
-- security definer so a policy on `profiles` can check the caller's own
-- is_admin flag without recursing into the RLS it's part of.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- new-user trigger
-- Mirrors the signup metadata shape already sketched in
-- src/app/create-account/page.tsx's signUpStub comment, so wiring real
-- Supabase auth later is a straight swap.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, account_type, company_name, vat_number, company_reg_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'account_type', 'home'),
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'vat_number',
    new.raw_user_meta_data ->> 'company_reg_number'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at housekeeping for the tables customers edit directly.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger boilers_set_updated_at
  before update on public.boilers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.boilers enable row level security;
alter table public.job_notes enable row level security;
alter table public.bookings enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.payments enable row level security;

-- profiles: read/update your own row; admins read/update everyone's.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- boilers: customers manage their own; admins manage everyone's (Fergal
-- logs the make/model he finds on site).
create policy "boilers: read own" on public.boilers
  for select using (auth.uid() = profile_id or public.is_admin());

create policy "boilers: write own" on public.boilers
  for insert with check (auth.uid() = profile_id or public.is_admin());

create policy "boilers: update own" on public.boilers
  for update using (auth.uid() = profile_id or public.is_admin());

-- job_notes: customers can only ever read theirs — Fergal is the only
-- one who writes them.
create policy "job_notes: read own" on public.job_notes
  for select using (auth.uid() = profile_id or public.is_admin());

create policy "job_notes: admin write" on public.job_notes
  for insert with check (public.is_admin());

create policy "job_notes: admin update" on public.job_notes
  for update using (public.is_admin());

-- bookings: anyone (including a signed-out visitor) can submit the
-- contact/callout form; only the owning customer or an admin can read
-- them back.
create policy "bookings: public insert" on public.bookings
  for insert with check (true);

create policy "bookings: read own" on public.bookings
  for select using (auth.uid() = profile_id or public.is_admin());

create policy "bookings: admin update" on public.bookings
  for update using (public.is_admin());

-- stripe_customers / payments: customers can see their own; only an
-- admin (or, later, a server-side Stripe webhook using the service role
-- key, which bypasses RLS entirely) can write.
create policy "stripe_customers: read own" on public.stripe_customers
  for select using (auth.uid() = profile_id or public.is_admin());

create policy "stripe_customers: admin write" on public.stripe_customers
  for insert with check (public.is_admin());

create policy "stripe_customers: admin update" on public.stripe_customers
  for update using (public.is_admin());

create policy "payments: read own" on public.payments
  for select using (auth.uid() = profile_id or public.is_admin());

create policy "payments: admin write" on public.payments
  for insert with check (public.is_admin());

create policy "payments: admin update" on public.payments
  for update using (public.is_admin());

-- ---------------------------------------------------------------------
-- Storage: avatar / logo uploads
-- Public read (so <Image> can load them directly), but only the owner
-- (file path prefixed with their own uid) or an admin can write.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: owner write" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "avatars: owner update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
