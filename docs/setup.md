# Setting up live chat, texts, emails, the schedule and the team inbox

The follow-up system is ported from Kanvas Academy's. It runs on three
services. Each one is optional and switches on its own part, so you can set
them up one at a time. Until a service is set up, the site behaves as it
did before.

| Service  | What it switches on |
| -------- | ------------------- |
| Supabase | Live chat on the site (`/messages`), team login (`/login`), the team inbox (`/staff/messages`), booking forms saved as jobs, the schedule (`/staff/schedule`), customer pages (`/staff/customers`) and customer accounts (`/account`) |
| Resend   | Booking forms emailed to MPE; emails to customers when an engineer replies |
| Twilio   | Missed-call text backs, texts in and out, voicemail in the inbox |

All the variable names are in `.env.example`. Set them in Vercel under
**Project → Settings → Environment Variables**, then redeploy.

## How it fits together

### Missed calls

Every call to the Twilio number is answered by a greeting and goes to
voicemail. The call is filed in the inbox, with the voicemail and its
transcript.

A UK mobile also gets one text back (at most one every 12 hours):

> Thanks for calling MPE Heating. Our engineers are busy on a job right
> now, but we'll call you back as soon as we can. Or start a live chat and
> we'll reply there: …/messages

### Live chat

1. The chat opens with: "Hi, welcome to MPE! How can we help today?"
2. After the customer's first message, the chat asks for their email and,
   if we don't have it already, their mobile.
3. Once they leave their details, the chat prompts them to download the
   MPE app so they get a notification when an engineer replies.
4. Until the app's store links are set, the chat tells them we'll email
   them instead.

### Booking forms

Each booking form is emailed to MPE with the subject "New job: …". It is
also saved as a job under **Jobs** in the team inbox, by type:

- Call-out
- New boiler
- Service
- Plan
- Commercial
- Other

Each job has a status: new, contacted, booked, done or closed. The
customer's details also start, or join, their conversation in **Live
chat**.

### One place for everything

Website chat, texts, calls, voicemail and email replies all arrive in the
same customer conversation. Admins and engineers see every conversation,
and each new message notifies all of them. There is also a pinned team
chat for staff only.

### Schedule

`/staff/schedule` has two views, switched with the **Day / Month** toggle.

- **Month** shows every day's visits as coloured dots by kind, with a bar
  for how full the day is and a **Full** tag once less than an hour of the
  working day (8am–5pm) is left. Tap a day to open it.
- **Day** shows the visits on a timeline, with the free gaps in the
  working day marked. Tap a gap to book a visit in that window. Each
  visit's card below has the customer, address (opens in Maps), phone,
  boiler, access notes and the team's notes, plus Booked, Done and
  Cancelled buttons.

Visits are a call-out, repair visit, service, boiler install, quote visit
or other. Each kind starts with a usual window (call-outs and repairs 2
hours, services and quote visits 1 hour, installs all day), which can be
changed on any visit. Morning, Afternoon and All day buttons set common
windows. A visit can be for an existing customer, a new one added in the
same form, or nobody (e.g. "Van MOT").

**Book it** on a job in the inbox opens the add-visit form filled in from
that booking form, and marks the job booked once the visit is added.

### Customers

Every booking form and every customer who leaves their details in the chat
gets a customer record. The team can also add one by hand. A customer's
page at `/staff/customers` has:

- their contact details and boiler (make, model, age, where it is, last
  service) and access notes, all editable;
- **private notes**, which only the team sees;
- their upcoming and past visits, and every booking form they've sent;
- buttons to book a visit, call them, or open their messages.

### Customer accounts

At `/account`, customers sign in with a link emailed to them, with no
password. They see their upcoming visits and can update their own details
and boiler. They never see the team's notes. If they were chatting as a
website guest in the same browser, the conversation moves to their
account.

## 1. Supabase

1. Create a project at supabase.com (the London region is closest).
2. Open the **SQL editor**, paste in the whole of `supabase/schema.sql`,
   and run it. It is safe to run again after changes.
3. Go to **Authentication → Sign In / Providers** and turn on **Allow
   anonymous sign-ins**. Website visitors chat as anonymous users until
   they leave their details.
4. Under **Authentication → URL Configuration**, set the Site URL to the
   live site, and add `https://<site>/auth/confirm` to **Redirect URLs**.
   Customers' sign-in links come back there. Add
   `https://*-kanvas1.vercel.app/auth/confirm` too if you want them to
   work on preview deployments.
5. Add the team, in the SQL editor. Use the role `admin` for admins and
   `coach` for engineers (`coach` is the Academy's name for staff):
   ```sql
   insert into public.user_roles (email, role) values ('fergal@mpenortheast.co.uk', 'admin');
   insert into public.user_roles (email, role) values ('engineer@example.com', 'coach');
   ```
6. Create each person's login under **Authentication → Users → Add user**,
   with their email and a password. They then sign in at `/login`.
7. Copy these from **Project Settings → API** into Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. Resend

1. Add and verify MPE's domain in Resend (it gives you DNS records to add).
2. Create an API key, then set these in Vercel:
   - `RESEND_API_KEY`
   - `CONTACT_FROM_EMAIL`, e.g. `MPE <hello@mpenortheast.co.uk>`
   - `CONTACT_TO_EMAIL`, the inbox for booking forms. This defaults to
     `fergal@mpenortheast.co.uk`.
3. Optional: let customers reply to emails straight into the chat.
   1. Add a subdomain for inbound mail in Resend, e.g.
      `reply.mpenortheast.co.uk`, and set it as `CHAT_REPLY_DOMAIN`.
   2. Add a webhook for the `email.received` event pointing at
      `https://<site>/api/webhooks/resend`.
   3. Set the webhook's signing secret as `RESEND_WEBHOOK_SECRET`.

## 3. Twilio

1. Buy a UK number that can handle voice and SMS.
2. On the number's settings, set both webhooks to **HTTP POST**:
   - **A call comes in:** `https://<site>/api/webhooks/twilio/voice`
   - **A message comes in:** `https://<site>/api/webhooks/twilio`
3. Set these in Vercel:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`, which is always needed because it verifies
     Twilio's webhooks
   - `TWILIO_PHONE_NUMBER`, in E.164 form, e.g. `+447…`
   - Optional: `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET`
4. To get missed-call texts, customers need to call the Twilio number. You
   can point the number on the site at it, or forward the existing number
   to it when it's unanswered.

> Texts, calls and voicemail are recorded in the inbox. Customers can reply
> STOP to opt out of texts; that is honoured on every send.

## 4. The app (next stage)

When the MPE app is in the stores, set `NEXT_PUBLIC_APP_STORE_URL` and
`NEXT_PUBLIC_PLAY_STORE_URL`. The chat then shows the download buttons
after a customer leaves their details. The database is already in place
for push notifications to customers and staff (`push_tokens` and
`push_log`).
