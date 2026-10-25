# Setup checklist

Everything to switch on, in order, with every setting, endpoint and
environment variable. Tick as you go. `docs/setup.md` explains what each
part does. `<site>` is the live address, e.g. `https://mpenortheast.co.uk`.

Each service is optional and switches on its own part, so the site works
at every step. Set environment variables in Vercel under **Project →
Settings → Environment Variables** (Production, and Preview if you want
previews to work too), then **redeploy**: new values only apply to a new
deployment.

## 0. Vercel and the domain

- [ ] Point the domain at the Vercel project (**Project → Settings →
      Domains**) and set it as the primary domain.
- [ ] `NEXT_PUBLIC_SITE_URL` = the live address, e.g.
      `https://mpenortheast.co.uk`. Every link in texts and emails uses it.
- [ ] Check the project is on a paid plan: the follow-up job runs every 5
      minutes, which the Hobby plan doesn't allow. (It's in the kanvas1
      team, which is on a paid plan.)

## 1. Supabase (the database, logins, live chat)

- [ ] Create a project at supabase.com, in the London region.
- [ ] **SQL editor:** paste in all of `supabase/schema.sql` and run it.
      Run it again after every update that changes it: it's safe to re-run.
- [ ] **Authentication → Sign In / Providers:** turn **on** "Allow
      anonymous sign-ins" (website visitors chat as guests).
- [ ] **Authentication → Sign In / Providers → Email:** leave email sign-in
      **on** (customers sign in with an emailed link).
- [ ] **Authentication → URL Configuration:**
  - [ ] Site URL = `<site>`
  - [ ] Redirect URLs: add `<site>/auth/confirm`
  - [ ] Optional, for preview deployments:
        `https://*-kanvas1.vercel.app/auth/confirm`
- [ ] **Authentication → Emails → SMTP:** optional, but set Resend as the
      SMTP sender so sign-in emails come from MPE's address, not Supabase's
      (and aren't limited to a few an hour).
- [ ] Add the team in the SQL editor (`admin` for Fergal, `coach` for any
      engineer):
      ```sql
      insert into public.user_roles (email, role) values ('fergal@mpenortheast.co.uk', 'admin');
      ```
- [ ] **Authentication → Users → Add user:** create each team member's
      login (email and password). They sign in at `<site>/login`.
- [ ] Environment variables, from **Project Settings → API**:

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key | **Secret** |

**Check:** `<site>/messages` shows the live chat, and you can log in at
`<site>/login`.

## 2. Resend (emails)

- [ ] Add MPE's domain at resend.com → **Domains**, and add the DNS records
      it gives you (SPF, DKIM, and the MX for the sending subdomain). Wait
      for it to say **Verified**.
- [ ] Create an API key (**API Keys → Create**, "Sending access").
- [ ] Optional, customers replying to emails straight into the chat:
  - [ ] Add an inbound subdomain, e.g. `reply.mpenortheast.co.uk`, with
        the MX records Resend gives you.
  - [ ] **Webhooks → Add:** `<site>/api/webhooks/resend`, event
        `email.received`. Copy its signing secret.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `RESEND_API_KEY` | The API key (`re_…`) | **Secret** |
| `CONTACT_FROM_EMAIL` | e.g. `MPE <hello@mpenortheast.co.uk>` (on the verified domain) | Config |
| `CONTACT_TO_EMAIL` | The inbox for booking forms (defaults to fergal@mpenortheast.co.uk) | Config |
| `CHAT_REPLY_DOMAIN` | Optional: the inbound subdomain | Config |
| `RESEND_WEBHOOK_SECRET` | Optional: the webhook's signing secret | **Secret** |

**Check:** send a booking form on the site; it arrives in `CONTACT_TO_EMAIL`.

## 3. Twilio (texts and missed calls)

- [ ] Buy a UK mobile number with **Voice** and **SMS** (Phone Numbers →
      Buy a number). UK numbers need a regulatory bundle (business address
      and ID): start that early, approval can take a few days.
- [ ] On the number's **Configure** page, both as **Webhook, HTTP POST**:
  - [ ] **A call comes in:** `<site>/api/webhooks/twilio/voice`
  - [ ] **A message comes in:** `<site>/api/webhooks/twilio`
- [ ] Optional: create an API key (**Account → API keys & tokens →
      Create**, Standard) for sending.
- [ ] Decide how calls reach it: put the Twilio number on the site, or
      forward Fergal's number to it when unanswered (missed-call texts only
      work for calls to the Twilio number).

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Console home (`AC…`) | Config |
| `TWILIO_AUTH_TOKEN` | Console home. Always needed: it checks Twilio's webhooks are real | **Secret** |
| `TWILIO_PHONE_NUMBER` | The number, as `+447…` | Config |
| `TWILIO_API_KEY_SID` | Optional: the API key (`SK…`) | Config |
| `TWILIO_API_KEY_SECRET` | Optional: the API key's secret | **Secret** |

**Check:** text the number; it appears in the team inbox. Ring it and hang
up; you get a text back with the chat link.

## 4. The follow-up job (reminders, follow-ups, monthly payments)

- [ ] `CRON_SECRET` = any long random string (e.g. from a password
      generator). Vercel signs its calls to `/api/cron/follow-ups` with it.
      Without it, nothing automatic runs: no reminders, no review asks, no
      monthly payments taken.
- [ ] After deploying, check **Project → Settings → Cron Jobs** lists
      `/api/cron/follow-ups` every 5 minutes, and that it's enabled.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `CRON_SECRET` | Make one up: 32+ random characters | **Secret** |

## 5. Stripe (payments, the maintenance plan, monthly payments)

First decide: MPE's **own Stripe account** (simplest), or one **connected
to Kanvas One's**. The steps are the same in whichever account takes the
money.

- [ ] Finish the account's business details and bank account
      (**Settings → Business**), so payouts work.
- [ ] **Settings → Payment methods:** turn **on** Cards, Apple Pay and
      Google Pay. Leave Link on if you like. Klarna is optional (not set up
      in the site yet).
- [ ] **Settings → Public details:** the statement name (what shows on
      bank statements, e.g. `MPE HEATING`) and the support phone and email.
- [ ] **Settings → Customer emails:** turn **on** "Successful payments"
      so Stripe emails a receipt for every card payment, including plan
      and monthly payments.
- [ ] **Settings → Billing → Subscriptions and emails:** for the
      maintenance plan, keep Smart Retries on for failed payments. The
      site already messages the customer when a plan payment fails, so
      Stripe's own failed-payment emails are optional.
- [ ] **Settings → Billing → Customer portal:** nothing to set. The site
      creates its own settings for it (update card and see payments; cancel
      is done on the site so the minimum term is kept).
- [ ] **Developers → Webhooks → Add endpoint:** `<site>/api/webhooks/stripe`,
      with these events:
  - [ ] `payment_intent.succeeded`: invoices, call-out fees and monthly
        payments
  - [ ] `checkout.session.completed`: joining the plan, a new card for
        monthly payments
  - [ ] `invoice.paid`: plan payments
  - [ ] `invoice.payment_failed`: failed plan payments
  - [ ] `customer.subscription.updated`: plan renewals and cancellations
  - [ ] `customer.subscription.deleted`: a plan ending
- [ ] If MPE's account is **connected** to Kanvas One's, the webhook goes
      on Kanvas One's account as a **Connect** webhook ("Listen to events on
      connected accounts").
- [ ] Optional, for Tap to Pay in the app later: **Terminal → Locations →
      New**, MPE's address.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | **Developers → API keys**, secret key (`sk_live_…`) | **Secret** |
| `STRIPE_WEBHOOK_SECRET` | The webhook's signing secret (`whsec_…`) | **Secret** |
| `STRIPE_TERMINAL_LOCATION` | Optional: the location id (`tml_…`) | Config |
| `STRIPE_CONNECT_ACCOUNT` | Only if connected to Kanvas One: MPE's `acct_…` | Config |
| `PLATFORM_FEE_PERCENT` | Only if connected: Kanvas One's percentage | Config |

**Check:** in test mode first (test keys, a test webhook): send yourself an
invoice and pay it with card `4242 4242 4242 4242`; it turns Paid. Then
switch to live keys and a live webhook.

## 6. In the site's Settings (`<site>/staff/settings`, as admin)

- [ ] **Maintenance plan:** monthly and/or yearly price, and a minimum
      term if you want one. No price, no online joining.
- [ ] **Google reviews:** the review link from the Google Business Profile
      (**Ask for reviews → copy link**).
- [ ] **Products and prices:** what MPE sells, and tick up to two to offer
      at repairs.

## 7. Meta pixel and ads (Facebook and Instagram)

Off until the pixel id is set. Then a cookie banner asks visitors first,
and the pixel only loads for people who accept. It never loads on private
pages (visits, invoices, the plan link, accounts, the team's pages).

- [ ] In Meta **Events Manager**, create a dataset (pixel) for MPE, or use
      the one in MPE's Business portfolio. Copy its id.
- [ ] **Business settings → Brand safety → Domains:** add and verify
      `mpenortheast.co.uk` (a DNS record, or the meta tag).
- [ ] **Events Manager → the dataset → Settings → Conversions API →
      Generate access token.**
- [ ] **Settings:** leave **Automatic advanced matching** off (the privacy
      policy doesn't cover the pixel reading form fields). Turning
      **automatic events** off is the tighter privacy choice.
- [ ] Set the variables below and redeploy. Then use **Test events** with
      `META_TEST_EVENT_CODE` set: send a booking form, and **Lead** should
      show from both Browser and Server, marked "Deduplicated". Remove the
      test code afterwards.
- [ ] If Events Manager asks for **Aggregated Event Measurement** for the
      domain, put **Lead** first.
- [ ] On every ad, under **URL parameters**, add:
      `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`.
      That's what puts "From: Facebook / Instagram ad · campaign · ad" on
      each job, and feeds "Where jobs came from" on Fergal's home page.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Events Manager → the dataset's id | Public (built into the pages: redeploy after changing) |
| `META_CONVERSIONS_API_ACCESS_TOKEN` | The Conversions API token above | **Secret** |
| `META_TEST_EVENT_CODE` | Optional: Events Manager → Test events. Remove after testing | **Secret** |

Events sent: **PageView** (public pages), **ViewContent** (the boiler
repair, servicing, new boilers and commercial pages), **Contact** (a tap
on the phone number or WhatsApp) and **Lead** (a booking form sent, from
the browser and the server, counted once).

## 8. The app (later)

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_STORE_URL` | The App Store listing | Public |
| `NEXT_PUBLIC_PLAY_STORE_URL` | The Google Play listing | Public |

## Before going live

- [ ] Decide whether MPE is VAT-registered. If it is, its VAT number and
      VAT need to go on invoices (not set up yet).
- [ ] Write the maintenance plan's terms (what's covered, what isn't,
      cancelling) for the Terms page. The site only promises what it
      already says: free call-outs all year round and a free yearly service.
- [ ] Check the phone number, email and Gas Safe number on the site are
      right.
- [ ] Do one of each, end to end, with a real card: a booking form, a
      call-out fee, an invoice, monthly payments, joining the plan.
