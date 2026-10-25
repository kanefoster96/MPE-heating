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
  status text not null default 'booked' check (status in ('booked', 'done', 'cancelled')),
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
create index if not exists appointments_day_idx on public.appointments (day, start_minute);
create index if not exists appointments_customer_idx on public.appointments (customer_id, day desc);
alter table public.appointments enable row level security;

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
