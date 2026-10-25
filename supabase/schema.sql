-- MPE: the database behind live chat, texts, missed calls, booking
-- enquiries and the team inbox (website now, the MPE app next).
--
-- Ported from Kanvas Academy's supabase/schema.sql, the proven version of
-- all of this. The table and column names are kept exactly as they are
-- there so the Academy's code and app work unchanged: "coach" is the
-- Academy's word for a member of staff, which at MPE means an engineer, and
-- "member" means a customer. The pages say engineer, team and customer.
--
-- Re-runnable: paste the whole file into the Supabase SQL editor (or run it
-- with psql) on a new project, and again after any change. Everything is
-- "if not exists" / "or replace" / guarded.
--
-- Also needed in the Supabase dashboard (not settable from SQL):
--   Authentication → Sign In / Providers → "Allow anonymous sign-ins" on
--   (website visitors chat as anonymous users until they leave details).

-- ---------------------------------------------------------------------------
-- Staff: who is an admin or an engineer.
--
-- Keyed by email so someone can be added before they've signed up. Only the
-- service-role key reads or writes it (no policies), so nobody can grant
-- themselves a role. Emails are stored lowercased.
--
-- To add the first admin (there's no screen for it until one exists):
--   insert into public.user_roles (email, role) values ('fergal@mpenortheast.co.uk', 'admin');
-- Engineers use the role 'coach' (the Academy's name for it):
--   insert into public.user_roles (email, role) values ('engineer@example.com', 'coach');
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'coach')),
  created_at timestamptz not null default now(),
  unique (email, role)
);
alter table public.user_roles enable row level security;

-- How a member of staff appears to customers on their chat replies: the
-- display name and photo an admin chose for them (lib/staff-identity.ts).
-- Keyed by email like user_roles. Service-role only.
create table if not exists public.staff_profiles (
  email text primary key check (email = lower(email)),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  avatar_url text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.staff_profiles enable row level security;

-- user_roles has no policies, so RLS policies elsewhere ask these
-- SECURITY DEFINER functions instead. Admins get everything an engineer gets.
create or replace function public.is_coach(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles r
    join auth.users u on lower(u.email) = lower(r.email)
    where u.id = uid and r.role in ('coach', 'admin')
      and coalesce(u.raw_app_meta_data ->> 'email_unverified', 'false') <> 'true'
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles r
    join auth.users u on lower(u.email) = lower(r.email)
    where u.id = uid and r.role = 'admin'
      and coalesce(u.raw_app_meta_data ->> 'email_unverified', 'false') <> 'true'
  );
$$;
grant execute on function public.is_admin(uuid) to authenticated;

-- Finds an account by email without listing every user. Server only.
create or replace function public.user_id_for_email(check_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(check_email)) limit 1;
$$;
revoke execute on function public.user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.user_id_for_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Live chat: one conversation per customer, every channel in one thread.
--
-- All writes go through the service-role key (server actions and webhooks),
-- so only select policies are needed.
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  -- The customer's account: a real one, an anonymous website visitor, or a
  -- phone-only contact made when someone texts or calls (lib/chat-db.ts).
  -- Null only for the team's own group chat (is_team).
  user_id uuid unique references auth.users (id) on delete cascade,
  -- For guests, who have no account email to display.
  guest_name text,
  guest_email text,
  -- Legacy in Kanvas Academy, kept so the app's API responses stay the same shape.
  assigned_coach_id uuid references auth.users (id) on delete set null,
  last_message_at timestamptz not null default now(),
  member_last_read_at timestamptz,
  -- Shared by the whole team: once anyone has read it, it's read.
  coach_last_read_at timestamptz,
  -- Marked done by the team (moves to History). Any new message reopens it.
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  visitor_id uuid,
  -- The number texts go to and come from (set by hand, or the first time
  -- someone texts, calls or books with it).
  phone text,
  -- Where the customer last wrote from: 'web' gets reply emails, 'app'
  -- gets pushes (lib/chat-notify.ts).
  member_last_source text check (member_last_source in ('web', 'app')),
  -- Heartbeat while the chat is open, so someone mid-chat isn't also emailed.
  member_last_active_at timestamptz,
  -- When the last "you've got a reply" email went (one per burst).
  member_notified_at timestamptz,
  -- When we asked a quiet visitor for their email (lib/chat-email-prompt.ts).
  email_prompt_sent_at timestamptz,
  -- The token in the Reply-To of reply emails, so an emailed reply lands
  -- back in this conversation (api/webhooks/resend).
  reply_token text,
  -- MPE's chat flow: when the welcome went out, when we asked for an email
  -- (and mobile), and when we suggested the app (src/lib/chat-welcome.ts).
  welcome_sent_at timestamptz,
  details_asked_at timestamptz,
  app_prompt_sent_at timestamptz,
  -- The team's own group chat (lib/team-chat.ts).
  is_team boolean not null default false,
  created_at timestamptz not null default now()
);
-- For a database made from an earlier version of this file.
alter table public.chat_conversations add column if not exists welcome_sent_at timestamptz;
alter table public.chat_conversations add column if not exists details_asked_at timestamptz;
alter table public.chat_conversations add column if not exists app_prompt_sent_at timestamptz;

alter table public.chat_conversations drop constraint if exists chat_conversations_owner_check;
alter table public.chat_conversations add constraint chat_conversations_owner_check check (is_team or user_id is not null);
create unique index if not exists chat_conversations_one_team_idx on public.chat_conversations (is_team) where is_team;
create unique index if not exists chat_conversations_phone_idx on public.chat_conversations (phone) where phone is not null;
create unique index if not exists chat_conversations_reply_token_idx on public.chat_conversations (reply_token) where reply_token is not null;

alter table public.chat_conversations enable row level security;
drop policy if exists "Members read their own conversation, coaches read all" on public.chat_conversations;
create policy "Members read their own conversation, coaches read all"
  on public.chat_conversations for select
  using (auth.uid() = user_id or public.is_coach(auth.uid()));

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  -- Null means MPE itself sent it (the welcome, the email ask, the
  -- missed-call text) rather than a person.
  sender_id uuid references auth.users (id) on delete cascade,
  sender_is_coach boolean not null default false,
  -- Empty string when the message is attachment-only.
  body text not null,
  attachment_path text,
  attachment_type text check (attachment_type in ('image', 'video', 'file')),
  attachment_name text,
  -- How it travelled: 'chat' (in-app), 'email' or 'sms'. A staff reply by
  -- text or email is still saved here, so the thread has everything.
  channel text not null default 'chat' check (channel in ('chat', 'email', 'sms')),
  -- An inbound email reply's Message-ID, so a webhook retry can't add it twice.
  email_message_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists chat_messages_email_message_id_idx
  on public.chat_messages (email_message_id) where email_message_id is not null;
create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_messages enable row level security;
drop policy if exists "Members and coaches can read their conversation's messages" on public.chat_messages;
create policy "Members and coaches can read their conversation's messages"
  on public.chat_messages for select
  using (
    public.is_coach(auth.uid())
    or exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Each person's own read time in the team chat.
create table if not exists public.chat_team_reads (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now()
);
alter table public.chat_team_reads enable row level security;

insert into public.chat_conversations (is_team, last_message_at)
select true, now() where not exists (select 1 from public.chat_conversations where is_team);

-- Live updates: new messages and conversation changes reach open chats.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_conversations'
  ) then
    alter publication supabase_realtime add table public.chat_conversations;
  end if;
end $$;

-- Each conversation's latest message, for the inbox previews. Server only.
create or replace function public.chat_latest_messages()
returns table (conversation_id uuid, body text, sender_is_coach boolean, attachment_type text, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select distinct on (m.conversation_id) m.conversation_id, m.body, m.sender_is_coach, m.attachment_type::text, m.created_at
  from public.chat_messages m
  order by m.conversation_id, m.created_at desc;
$$;
revoke execute on function public.chat_latest_messages() from public, anon, authenticated;
grant execute on function public.chat_latest_messages() to service_role;

-- Photos and files sent in the chat, and voicemails. Private, read through
-- short-lived signed URLs. Paths are "{conversationId}/{filename}".
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Conversation participants can view chat attachments" on storage.objects;
create policy "Conversation participants can view chat attachments"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.user_id = auth.uid() or public.is_coach(auth.uid()))
    )
  );

drop policy if exists "Conversation participants can upload chat attachments" on storage.objects;
create policy "Conversation participants can upload chat attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.user_id = auth.uid() or public.is_coach(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- Booking enquiries: every booking form, filed as a job by category.
--
-- MPE's own table (Kanvas Academy has no equivalent). Each enquiry is also
-- posted into the customer's chat conversation, so the team sees it in the
-- inbox alongside their texts, calls and chat (src/lib/enquiries.ts).
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  -- Which form: a call-out, a new boiler quote, a service, a maintenance
  -- plan, commercial, or anything else (the contact form and other trades).
  category text not null check (category in ('callout', 'new_boiler', 'service', 'plan', 'commercial', 'other')),
  -- new → contacted → booked → done, or closed if it went nowhere.
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'done', 'closed')),
  name text,
  email text,
  -- As typed, and in E.164 for texting and matching a caller to a booking.
  phone text,
  phone_e164 text,
  postcode text,
  same_day boolean not null default false,
  -- The cards picked, e.g. {"Plumbing","Leak or burst pipe"}, and each
  -- question with its answer.
  path text[] not null default '{}',
  answers jsonb not null default '[]'::jsonb,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index if not exists enquiries_status_idx on public.enquiries (status, created_at desc);
create index if not exists enquiries_category_idx on public.enquiries (category, created_at desc);
create index if not exists enquiries_phone_idx on public.enquiries (phone_e164);

alter table public.enquiries enable row level security;
-- Live updates carry the old row too, so the staff badge can tell when an
-- enquiry moves on from "new" (src/components/chat/chat-badge.tsx).
alter table public.enquiries replica identity full;
drop policy if exists "Staff read enquiries" on public.enquiries;
create policy "Staff read enquiries"
  on public.enquiries for select
  using (public.is_coach(auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enquiries'
  ) then
    alter publication supabase_realtime add table public.enquiries;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Customers: one record per household, with their address and boiler.
--
-- Made from a booking form, from the details someone leaves in the chat, or
-- by the team by hand (lib/customers.ts). The customer can edit their own
-- contact and boiler details from /account once they've signed in with
-- their email (user_id is then their login); the team can edit everything.
-- Service-role only: every read and write goes through the server, which
-- checks who's asking, so the team's private notes (below) can never leak.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Their login, once they've signed in at /account.
  user_id uuid unique references auth.users (id) on delete set null,
  -- Their conversation in the team inbox (texts, chat, calls, emails).
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  name text,
  -- Stored lowercased.
  email text,
  -- As typed, and in E.164 for texting and matching.
  phone text,
  phone_e164 text,
  address text,
  postcode text,
  -- The boiler, as far as anyone knows it.
  boiler_make text,
  boiler_model text,
  boiler_age text,
  boiler_location text,
  last_service text,
  -- From the customer: parking, key safe, pets, anything for the visit.
  access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_email_idx on public.customers (email) where email is not null;
create unique index if not exists customers_phone_idx on public.customers (phone_e164) where phone_e164 is not null;
create index if not exists customers_conversation_idx on public.customers (conversation_id);
alter table public.customers enable row level security;

-- The team's private notes about a customer or their boiler. Never shown to
-- the customer. Service-role only.
create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  body text not null,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);
alter table public.customer_notes enable row level security;

-- Each booking form's customer.
alter table public.enquiries add column if not exists customer_id uuid references public.customers (id) on delete set null;
create index if not exists enquiries_customer_idx on public.enquiries (customer_id);

-- A booking form that hasn't turned into a visit yet: the customer is
-- followed up (twice at most) with a link to pick a time
-- (/request/<public_token>), and the team is nudged if it sits untouched.
alter table public.enquiries add column if not exists public_token text not null default replace(gen_random_uuid()::text, '-', '');
alter table public.enquiries add column if not exists followup_count integer not null default 0;
alter table public.enquiries add column if not exists followed_up_at timestamptz;
alter table public.enquiries add column if not exists staff_nudged_at timestamptz;
create unique index if not exists enquiries_public_token_idx on public.enquiries (public_token);

-- Where a booking form came from (Kanvas Academy's ad attribution): the
-- source ("Facebook / Instagram", "Google", "Direct"…), "paid" when an
-- advert's click id proved it (else the link's utm_medium), and the
-- campaign and advert from the link's utm tags. Recorded from the first
-- page of the visit, for everyone (src/lib/first-touch.ts). meta_context
-- holds the Meta click ids ({"meta_fbc", "meta_fbp"}), only for someone
-- who accepted the cookie banner (src/lib/meta-capi.ts).
alter table public.enquiries add column if not exists traffic_source text;
alter table public.enquiries add column if not exists traffic_medium text;
alter table public.enquiries add column if not exists traffic_campaign text;
alter table public.enquiries add column if not exists traffic_ad text;
alter table public.enquiries add column if not exists meta_context jsonb;

-- ---------------------------------------------------------------------------
-- The schedule: every visit, with a rough time window (lib/appointments.ts).
--
-- A day and a window in minutes after midnight, London time (480 = 8am), so
-- "8am–12pm" means the same thing all year round. The team's notes on a
-- visit are internal; the customer sees the kind, day, window and address.
-- Service-role only.
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  -- The booking form it came from, if any.
  enquiry_id uuid references public.enquiries (id) on delete set null,
  kind text not null check (kind in ('callout', 'repair', 'service', 'install', 'quote', 'other')),
  day date not null,
  start_minute integer not null check (start_minute >= 0 and start_minute < 1440),
  end_minute integer not null check (end_minute > start_minute and end_minute <= 1440),
  status text not null default 'booked',
  -- Short label for anything without a customer, e.g. "Van MOT".
  title text,
  address text,
  postcode text,
  notes text,
  -- Which engineer, once there's more than one.
  engineer_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Requests and letting the customer know (lib/visit-notify.ts).
--
-- A customer can ask for a visit (a booking form, or their account) on a
-- day, in the morning, afternoon or any time: it's saved as 'requested' in
-- that window until the team accepts it or moves it. Every visit has a
-- private link (/visit/<public_token>) the customer is sent, to see it, add
-- it to their calendar, or ask for another time (the change_* columns).
alter table public.appointments add column if not exists part text check (part in ('am', 'pm', 'any'));
alter table public.appointments add column if not exists source text not null default 'team' check (source in ('team', 'website', 'account'));
alter table public.appointments add column if not exists public_token text not null default replace(gen_random_uuid()::text, '-', '');
alter table public.appointments add column if not exists notified_at timestamptz;
alter table public.appointments add column if not exists notified_via text[] not null default '{}';
-- What they were last told: 'booked', 'moved', 'cancelled' or 'reminder'.
alter table public.appointments add column if not exists last_notice text;
alter table public.appointments add column if not exists reminded_at timestamptz;
alter table public.appointments add column if not exists change_day date;
alter table public.appointments add column if not exists change_part text check (change_part in ('am', 'pm', 'any'));
alter table public.appointments add column if not exists change_note text;
alter table public.appointments add column if not exists change_requested_at timestamptz;
create unique index if not exists appointments_public_token_idx on public.appointments (public_token);

-- Finishing a job (lib/job-completion.ts): what was done, in words the
-- customer sees on their visit page and account; when, and by whom; and
-- the review ask (sent a couple of hours later by the sweep, once, with one
-- reminder).
alter table public.appointments add column if not exists job_report text;
alter table public.appointments add column if not exists completed_at timestamptz;
alter table public.appointments add column if not exists completed_by uuid references auth.users (id) on delete set null;
alter table public.appointments add column if not exists review_due_at timestamptz;
alter table public.appointments add column if not exists review_asked_at timestamptz;
alter table public.appointments add column if not exists review_reminded_at timestamptz;

-- A customer's review of a job: their stars and words, for MPE. Everyone is
-- also asked to post it publicly (the review link in Settings), whatever
-- they rated: asking only happy customers is review gating. Service-role only.
create table if not exists public.job_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  public_clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists job_reviews_customer_idx on public.job_reviews (customer_id, created_at desc);
alter table public.job_reviews enable row level security;

-- Simple settings the team changes from Settings: e.g. review_url. Service-role only.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- The follow-up sweep (lib/follow-up-sweep.ts): each message goes once.
-- 'no_access': the engineer called and couldn't get in; the customer is
-- offered another time the next day.
alter table public.appointments add column if not exists hour_reminded_at timestamptz;
alter table public.appointments add column if not exists missed_followup_at timestamptz;
alter table public.appointments add column if not exists service_due_sent_at timestamptz;
alter table public.appointments add column if not exists staff_nudged_at timestamptz;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('requested', 'booked', 'done', 'no_access', 'cancelled'));
create index if not exists appointments_day_idx on public.appointments (day, start_minute);
create index if not exists appointments_customer_idx on public.appointments (customer_id, day desc);
alter table public.appointments enable row level security;

-- ---------------------------------------------------------------------------
-- Products and prices (Settings, lib/products.ts): what MPE sells, for
-- one-tap invoice lines. Up to two are offered at repairs ("upsell"), at an
-- offer price, as tick boxes on the customer's pay page. Service-role only.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_pence integer not null check (price_pence > 0),
  upsell boolean not null default false,
  -- The price when it's added at a repair (about 20% off: he's already there).
  upsell_price_pence integer check (upsell_price_pence is null or upsell_price_pence > 0),
  sort integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_sort_idx on public.products (archived, sort, created_at);
alter table public.products enable row level security;

-- ---------------------------------------------------------------------------
-- Payments (lib/payments.ts): a call-out fee or an invoice for a visit,
-- sent into the customer's conversation with a Pay link (Kanvas Academy's
-- payment_requests). Paid by Stripe Checkout (Apple Pay, Google Pay, card),
-- the card they saved with MPE, Tap to Pay in the MPE app, or marked paid
-- in person (another card machine, cash, bank transfer). Service-role only.
create sequence if not exists public.invoice_number_seq start 1001;

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  kind text not null default 'invoice' check (kind in ('callout_fee', 'invoice', 'other')),
  -- MPE-1001, MPE-1002…: on the invoice and the receipt.
  number integer not null default nextval('public.invoice_number_seq'),
  description text not null,
  -- Each line: {"description": "Diverter valve", "amount_pence": 8500}.
  -- A negative line is a credit (the call-out fee taken off the repair).
  lines jsonb not null default '[]'::jsonb,
  amount_pence integer not null check (amount_pence > 0),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  paid_at timestamptz,
  paid_via text check (paid_via in ('link', 'app', 'saved_card', 'tap_to_pay', 'in_person', 'cash', 'bank_transfer')),
  stripe_payment_intent_id text,
  -- Set while the saved card is being charged, so two taps can't both charge.
  charging_at timestamptz,
  -- Unpaid reminders (lib/follow-up-sweep.ts).
  reminder_count integer not null default 0,
  reminded_at timestamptz,
  public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index if not exists payment_requests_number_idx on public.payment_requests (number);
create unique index if not exists payment_requests_token_idx on public.payment_requests (public_token);
create index if not exists payment_requests_customer_idx on public.payment_requests (customer_id, created_at desc);
create index if not exists payment_requests_appointment_idx on public.payment_requests (appointment_id);
create index if not exists payment_requests_open_idx on public.payment_requests (status, created_at) where status = 'open';
alter table public.payment_requests enable row level security;

-- Up to two add-ons the customer can tick on the pay page (Fergal's
-- repair upsells from Settings, e.g. a boiler service while he's already
-- there at about 20% off). Each: {"product_id", "label", "pence",
-- "usual_pence", "taken"}. Only added to the invoice once they pay with it
-- ticked.
alter table public.payment_requests add column if not exists offers jsonb not null default '[]'::jsonb;

-- The chat message a payment request was sent as, so the chat shows a Pay card.
alter table public.chat_messages add column if not exists payment_request_id uuid references public.payment_requests (id) on delete set null;
-- The customer in Stripe, once they've saved a card with MPE.
alter table public.customers add column if not exists stripe_customer_id text;

-- Paying an invoice monthly (lib/instalments.ts). Fergal lets them spread
-- an invoice over up to 12 monthly payments, interest-free, with any
-- deposit taken first (12 or fewer, within a year, nothing added: outside
-- consumer credit rules). Their first payment saves their card; then it's
-- charged on the same date each month, the monthly amount or what's left
-- if that's less, until the balance is paid. They can pay off any amount
-- whenever they like, and a missed month just leaves more to pay.
alter table public.payment_requests add column if not exists instalments integer check (instalments is null or instalments between 2 and 12);
alter table public.payment_requests add column if not exists instalment_deposit_pence integer not null default 0;
-- Once they've started: 'active', 'past_due' (the last charge failed),
-- 'completed' (all paid) or 'stopped' (the team stopped it).
alter table public.payment_requests add column if not exists plan_status text check (plan_status in ('active', 'past_due', 'completed', 'stopped'));
alter table public.payment_requests add column if not exists plan_started_at timestamptz;
alter table public.payment_requests add column if not exists plan_monthly_pence integer;
alter table public.payment_requests add column if not exists plan_next_due_on date;
-- The card it's taken from (a Stripe payment method on their customer).
alter table public.payment_requests add column if not exists plan_payment_method text;
alter table public.payment_requests add column if not exists plan_failed_at timestamptz;
-- Set while a monthly payment is being taken, so two runs can't both take it.
alter table public.payment_requests add column if not exists plan_charging_at timestamptz;
alter table public.payment_requests drop column if exists plan_subscription_id;
alter table public.payment_requests drop constraint if exists payment_requests_paid_via_check;
alter table public.payment_requests add constraint payment_requests_paid_via_check
  check (paid_via in ('link', 'app', 'saved_card', 'tap_to_pay', 'in_person', 'cash', 'bank_transfer', 'instalments'));
create index if not exists payment_requests_plan_due_idx on public.payment_requests (plan_next_due_on) where plan_status in ('active', 'past_due');

-- Every payment towards an invoice being paid monthly: the first, each
-- month's, anything extra they pay off, and money Fergal takes in person.
-- A Stripe payment is counted once, however often Stripe tells us.
create table if not exists public.instalment_payments (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references public.payment_requests (id) on delete cascade,
  amount_pence integer not null check (amount_pence > 0),
  kind text not null default 'monthly' check (kind in ('first', 'monthly', 'extra', 'in_person')),
  stripe_payment_intent_id text unique,
  paid_via text,
  recorded_by uuid references auth.users (id) on delete set null,
  paid_at timestamptz not null default now()
);
-- From the first draft of this table (a Stripe invoice per payment).
alter table public.instalment_payments add column if not exists kind text not null default 'monthly' check (kind in ('first', 'monthly', 'extra', 'in_person'));
alter table public.instalment_payments add column if not exists stripe_payment_intent_id text unique;
alter table public.instalment_payments add column if not exists paid_via text;
alter table public.instalment_payments add column if not exists recorded_by uuid references auth.users (id) on delete set null;
alter table public.instalment_payments drop column if exists stripe_invoice_id;
create index if not exists instalment_payments_request_idx on public.instalment_payments (payment_request_id, paid_at);
alter table public.instalment_payments enable row level security;

-- ---------------------------------------------------------------------------
-- The maintenance plan (lib/maintenance-plan.ts): free call-outs all year
-- round and a free yearly service, paid monthly or yearly by Stripe
-- subscription (Kanvas Academy's memberships). The prices, and any minimum
-- term, are set in Settings. A row starts 'pending' when the customer is
-- sent the link (or opens it from their account), and is 'active' once
-- they've paid; 'past_due' when a payment fails, 'ended' when it's over.
-- cancel_at is set while it's due to end. Service-role only.
create table if not exists public.plan_members (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'ended')),
  billing text check (billing in ('month', 'year')),
  price_pence integer,
  -- The minimum term when they joined, in months (0: none).
  min_months integer not null default 0,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  -- Their free yearly service: the last one done while on the plan.
  last_service_on date,
  payment_failed_at timestamptz,
  public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists plan_members_token_idx on public.plan_members (public_token);
create index if not exists plan_members_customer_idx on public.plan_members (customer_id, created_at desc);
create unique index if not exists plan_members_one_live_idx on public.plan_members (customer_id) where status in ('active', 'past_due');
alter table public.plan_members enable row level security;

-- ---------------------------------------------------------------------------
-- App push notifications (the MPE app, next stage).

-- One Expo push token per signed-in device. Service-role only.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

-- Every push sent and Expo's answer, so "I didn't get a notification" can
-- be traced. Service-role only.
create table if not exists public.push_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  device text,
  kind text,
  title text,
  status text not null,
  error text,
  ticket_id text,
  -- What Apple or Google said, read back from Expo's receipt later.
  receipt text
);
create index if not exists push_log_user_time_idx on public.push_log (user_id, created_at desc);
create index if not exists push_log_time_idx on public.push_log (created_at);
alter table public.push_log enable row level security;

-- ---------------------------------------------------------------------------
-- Texts and emails.

-- Numbers that replied STOP. Checked before every text (lib/twilio.ts).
create table if not exists public.sms_opt_outs (
  phone text primary key,
  opted_out_at timestamptz not null default now(),
  keyword text
);
alter table public.sms_opt_outs enable row level security;

-- Every email the site sends (lib/resend.ts).
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text,
  html text,
  resend_id text,
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists email_log_to_idx on public.email_log (lower(to_email), sent_at desc);
alter table public.email_log enable row level security;
