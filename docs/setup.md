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
| Stripe   | Call-out fees and invoices paid online (Apple Pay, Google Pay, card), saved cards, Tap to Pay in the app |

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

### Letting customers know

When you add a visit for a customer, **Send them the details** is ticked.
The form shows the exact words they'll get. On save, it goes every way we
can reach them:

- a message in their conversation, so the inbox keeps the record and their
  reply lands in the same thread;
- an email, if we have their address;
- a text, if we have a UK mobile and Twilio is set up;
- a notification, if they have the MPE app.

Moving a visit to another day or time tells them it's moved. Each visit's
card shows what they were sent, how and when, with **Send again**. A
cancelled visit has **Tell them it's cancelled**.

Reminders and follow-ups then happen automatically. See **Automatic
reminders and follow-ups** below.

Every message links to the customer's own page for that visit
(`/visit/...`). No sign-in is needed. From there they can see the visit,
add it to their calendar, or ask for another time (a day, plus morning,
afternoon or any time). That ask shows on your schedule as **Can't make
this**, with **Move it** (opens the edit form at their time) and **Keep
this time**.

### Requests from customers

Customers can ask for a visit:

- on the call-out and service booking forms (**When suits you?**);
- from their account (**Request a visit**).

Requests sit on the schedule as dashed outlines on the day they asked for,
in the morning (8am–12pm), afternoon (12pm–5pm) or all day. They don't
count toward a full day until you accept them. Everything waiting is listed
at the top of the schedule and badged on the Schedule tab. Each has:

- **Accept**, which books it as asked and lets them know;
- **Change time**, which opens it in the edit form, so you can pick a slot
  you do have and let them know;
- **Message**, to talk it over first;
- **Decline**.

### Automatic reminders and follow-ups

These follow Kanvas Academy's approach to getting people booked and
getting them to turn up. Each message goes once, by message, text, email
and the app, whichever we have. Texts use plain characters only, so they
don't cost extra.

| When | Who gets it | What it says |
| ---- | ----------- | ------------ |
| On booking | The customer | The details, with their visit link (sent from the schedule, as above) |
| The evening before, from 6pm | Booked visits tomorrow | A reminder, and "if you can't make it, let us know". Skipped if they were only booked that afternoon. |
| About an hour before the window | Booked visits today | "Just confirming Fergal from MPE will be with you today between 10am and 12pm for your call-out. If anything's changed, call…" It names whoever booked the visit, and gives nothing to do except call if something's changed. |
| Midday the day after **Not in** | Visits marked Not in | "Sorry we missed you", with their link to pick another time |
| A day after a booking form, if there's no visit yet | The customer | What they asked about, in their own words, and a link to pick a day and time (`/request/...`) |
| Three days after that | The customer | One last check-in that says we won't message about it again |
| 11 months after a service or install | The customer | Their annual service is due, with a link to book |
| A new job or visit request unanswered for 2 hours, 8am to 7pm | Every admin and engineer | A push: "2 new jobs have been waiting over two hours" |

Follow-ups on a booking form stop as soon as:

- there's a visit for that customer;
- the team or the customer has written in their conversation;
- the form is marked anything but new or contacted.

Customer messages go out between 10am and 7pm, except the evening-before
reminder and the hour-before message. Each visit card shows which reminders
have gone and when. Jobs in the inbox show if they've been followed up.

### On my way

On the day of a booked visit, its card on the schedule has **On my way?**
with 15 min, 30 min, 45 min, 1 hour and 1½ hours. One tap texts the
customer, e.g. "Fergal from MPE is on the way for your service and should
be with you in about 30 minutes (around 9:45am)". It also goes in their
chat and the app, and by email only if they've no mobile. Their visit page
shows "We're on the way: with you around 9:45am", and the card shows when
it was sent. The engineer's first name comes from their profile; without
one it says "your MPE engineer".

### Quotes

Mostly for new boilers. On a quote or install visit, tap **Write a quote**,
or **New quote** on a customer's page:
- **What it's for**, a line per part and the labour (products are one
  tap), and **what's included**, which they see on the quote.
- **Deposit to accept it** (optional), how long it's **open** (14 to 90
  days), and **Offer the rest monthly** (2 to 12 payments).

It's sent by text, message, email and the app as a link to the quote, e.g.
"here's your quote Q-1001 for a new combi boiler: £2,450, with a £500
deposit to book in". On the quote page they can:
- **Accept and pay the deposit**, by Apple Pay, Google Pay or card. With
  no deposit, it's just **Accept**.
- Say **Not for me**, with an optional reason.

The team gets a push either way. The customer gets a thank-you saying
we'll be in touch to book the date.

Follow-ups: two days after sending, "just checking you got your quote";
four days after that, the last word with the date it runs out. Both stop
the moment they answer. The day after it runs out, it lapses.

Fergal sees each quote's progress (sent, opened, followed up, accepted
with the deposit, declined and why) under **Home → Quotes**, on the
customer's page and on the visit card. Home shows accepted quotes still to
book in, and how many quotes are out and what they're worth. Once the work
is done, **Work done: invoice the rest** sends the invoice with the deposit
taken off, with monthly payments if the quote offered them.

### Taking payment

Tap **Take payment** on a visit card, or in a customer's chat (**+ → Take
payment**), or on their customer page. There are two choices.

**Call-out fee.** One tap sends them the £50 call-out fee, the amount the
site promises. If they go ahead with the repair, it comes off the invoice
automatically.

**Invoice for the job.** Add a line per part and the labour, in pounds. A
call-out fee they've already paid on that visit is added as a "Call-out fee
already paid" credit line. Remove that line if it shouldn't apply.

Then choose how to take it:

- **Send them the invoice.** It goes by message, text, email and the app,
  as a link to their invoice page. They pay with Apple Pay, Google Pay or
  card through Stripe. In the chat it shows as a card with **Pay**, which
  turns to **Paid ✓** by itself.
- **Charge their card ending 4242.** Shown when they've saved a card with
  MPE. Ask them first, then tap. If their bank wants them to approve it,
  the link is sent instead.
- **They've paid me in person.** Record a card machine, cash or bank
  transfer payment. They're sent a receipt.

Customers save a card by ticking **Save my card with MPE for future visits**
when they pay a link. It's never saved without that tick. Once saved,
"Card on file" shows on the Take payment page.

**Extras at a repair.** Under **Settings** (the gear icon, for admins),
Fergal adds the products he sells, at his prices. They become one-tap
lines on an invoice. He can tick up to two as **Offered at repairs**, each
with a price at a repair; leave that blank and it's about 20% off. On an
invoice for a repair those extras are pre-ticked, and Fergal can untick
them or change their price for that invoice. They appear on the customer's
pay page under "While we're with you" as tick boxes, and the total updates
as they tick. If they pay with one ticked, it's added to their invoice and
receipt, and Fergal gets a push to do it before he leaves. Settings also
suggests quick, good-margin jobs that fit a repair visit: a service, a
magnetic system filter, a CO alarm, an inhibitor top-up, TRVs. Only the
service has a price on the site (from £79); Fergal sets the rest.

Every invoice has a number (MPE-1001, MPE-1002, and so on) and its own
page. Before payment that page is the invoice, and afterwards the receipt.
Customers can print it or save it as a PDF, and their account lists all of
them. Unpaid ones get a reminder after 3 days and again after 7. After 10
days the team gets a push saying it needs chasing. The team also gets a
push whenever a payment comes in.

**Tap to Pay** (taking a contactless card on Fergal's phone) works on
iPhone and Android in the UK through Stripe Terminal. It has to run inside
a native app, so it arrives with the MPE app. The server side is ready:
`/api/terminal/connection-token` and
`/api/payment-requests/<id>/tap-to-pay`. Until then, use **They've paid me
in person** for any card machine Fergal already has.

**Paying monthly.** On an invoice, tick **Let them pay monthly** and pick
how many payments (2 to 12) and any deposit. The preview shows exactly
what they'll be offered, e.g. "£650 today (including a £500 deposit), then
£150 a month on the same date for 9 months". Their pay page then offers
that next to paying in full.

How it runs:
- **Set dates.** Their first payment (the deposit and first month) saves
  their card. After that, the card is charged on the same date each month
  (the 1st to the 28th), by the 5-minute follow-up job from 10am.
- **Until it's paid.** Each month takes the monthly amount, or what's left
  if that's less, so the last payment adjusts itself (e.g. £25 left on a
  £50 a month plan takes £25). It doesn't end until the balance is £0.
- **Pay off any time.** On their invoice page they can see what's left,
  every payment made and the next date. They can pay off any amount, or
  the rest in one go, and change the card. Paying extra doesn't change
  the dates or the monthly amount; it just finishes sooner.
- **Missed payments.** If a month's payment fails, it's still owed and the
  dates carry on. They're sent the link to pay it or change card, and the
  team gets a push.
- **In person.** On the Take payment page, "They've paid some in person"
  records cash, card machine or bank transfer towards the balance.
  **Stop monthly payments** stops the dates (what's left can still be paid
  off), and **Restart** starts them again.
- **Paid off.** When the balance reaches £0 the invoice is marked paid and
  they get a receipt.

Keep it to 12 payments or fewer within a year, with nothing added:
interest-free credit like that doesn't need FCA consumer credit
authorisation. Longer terms, or charging interest, need a finance provider.
The site won't offer more than 12. The work is usually done before it's all
paid, so it's Fergal's risk if someone stops paying.

### Maintenance plan

The plan includes what the site already says: free call-outs all year
round and a free yearly service. Set its price under **Settings →
Maintenance plan**: monthly, yearly or both. A minimum term is optional.
With no price set, the plan's booking form still takes enquiries, but no
one can join online. Members keep the price they joined at.

**Joining.** On a customer's page, **Send them the plan** sends their own
link by message, text, email and the app. They choose monthly or yearly
and pay by Apple Pay, Google Pay or card. Customers can also join from
their account. The team gets a push when someone joins, and the customer
gets a welcome message.

**Day to day.**
- A member's visits show a green **Plan** chip on the schedule, and their
  page says "On the maintenance plan".
- The Take payment page doesn't offer a member the call-out fee. On a
  service, it notes the service is included.
- Finishing a service with "Serviced on this visit" ticked records it as
  their yearly service.
- **Customers → Plan members** lists everyone, roughly what the plan brings
  in a month, failed payments, and who's leaving.

**Changes.** Members manage it from their account:
- **Update card and see payments** opens Stripe's billing page.
- **Cancel my plan** runs it to the end of what they've paid for, or to
  the end of the minimum term if that's later.
- **Keep my plan** undoes a cancellation.

The team can do the same from the customer's page, and can also end a plan
today. A failed payment sends them Stripe's link to pay it or update their
card, and the team gets a push.

### Finishing a job and reviews

Tapping **Done** on a visit opens a short finish screen:

- **What we did:** the customer sees this on their visit page and in their
  account. It starts from the invoice's lines.
- **Their boiler:** make, model, age and where it is. **Serviced on this
  visit** sets "last serviced", and their service-due reminder follows 11
  months later.
- **Note for next time:** the team only. It's added to the customer's
  private notes.
- **Send a summary:** what was done, with their invoice or receipt. On by
  default.
- **Ask for a review:** sent about two hours later, in the daytime, with one
  reminder after three days. It's skipped if they've reviewed anything in
  the last six months.

The review page asks for stars and an optional comment. Both go to MPE:
into the customer's conversation, with a push to the team. Then everyone
gets a **Post a Google review** button, whatever they gave. Asking only
happy customers is "review gating", which Google's rules don't allow. A
low score also tells them Fergal will be in touch.

Set the Google review link under **Settings → Google reviews**. On your
Google Business Profile, tap **Ask for reviews** and copy the link. Until
it's set, customers can still rate the job; they just aren't sent to
Google.

Reviews show on the customer's page against each visit, including whether
they went on to Google.

### Fergal's home page

After logging in, the team lands on **Home** (`/staff`):
- **Needs you:** unread messages, new jobs, visit requests to confirm,
  invoices unpaid over a week, and failed monthly or plan payments. Each
  one links to where it's dealt with. When nothing's waiting, it says so.
- **Today:** the day's visits, and **next two weeks**: how full each day
  is, 8am to 5pm.
- **The business:** taken this month (against last month), owed, plan
  members and roughly what they bring in a month, and reviews over the
  last 90 days.
- **New jobs this month:** booking forms, how many were booked in, and
  where they came from (Facebook or Instagram ads, Google, direct). This
  needs the Meta pixel and ad links set up (docs/setup-checklist.md).
- **Invoices** (`/staff/invoices`): everything unpaid and for how long,
  everything being paid monthly and what's left, and the last 90 days paid.

On a phone, **Log out** is at the bottom of Home.

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
password. They see their upcoming and past visits and their maintenance
plan, and can:
- update their details, address and boiler, including notes about the
  boiler (noises, error codes) that the team sees on the visit card;
- see every invoice, call-out fee and plan payment, with receipts to print
  or save;
- see their saved cards, add one, and remove one that isn't in use. A
  card their plan or monthly payments use is changed from the plan or the
  invoice first. They never see the team's notes. If they were chatting as a
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

## 4. Automatic reminders and follow-ups

Set `CRON_SECRET` in Vercel to any long random string. Vercel then runs
`/api/cron/follow-ups` every five minutes (`vercel.json`) and signs the
call with it. Without it, nothing automatic is sent. Every message is
recorded once it's sent, so running it more often never sends anything
twice.

## 5. Stripe

1. In Stripe, turn on Apple Pay and Google Pay under **Settings →
   Payment methods**. Checkout shows them automatically.
2. Copy the secret key into `STRIPE_SECRET_KEY`.
3. Add a webhook to `https://<site>/api/webhooks/stripe` for these events:
   `payment_intent.succeeded`, `checkout.session.completed`,
   `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.updated` and `customer.subscription.deleted`.
   The last five are for the maintenance plan and monthly payments. Copy
   its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. For Tap to Pay (with the app), create a location under **Terminal →
   Locations** and set its id as `STRIPE_TERMINAL_LOCATION`.

## 6. The app (next stage)

When the MPE app is in the stores, set `NEXT_PUBLIC_APP_STORE_URL` and
`NEXT_PUBLIC_PLAY_STORE_URL`. The chat then shows the download buttons
after a customer leaves their details. The database is already in place
for push notifications to customers and staff (`push_tokens` and
`push_log`).
