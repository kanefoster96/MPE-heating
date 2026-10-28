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
- [ ] Re-run it after the out-of-hours chat update: it adds the once-a-night
      "we're back at 8am" note (or whenever you open) and the two-hour
      reminder for unanswered chats. Until you do, the chat works but neither is sent.
- [ ] Re-run it after the "price to send" update: it adds "price still to
      send" to a call-out finished as coming back. Until you do, jobs still
      finish, but nothing goes on the "price to send" list.
- [ ] Re-run it after the calls and texts allowance update: it adds the
      record of call minutes and texts (for the £30 allowance), and the
      once-only text after a first call.
- [ ] Re-run it after the running-late update: it adds "won't be in" to
      visits and "how did they hear about us?" to customers.
- [ ] Re-run it after the return-visit update: it adds "Is it fixed?" to
      finishing a job (fixed, or coming back), links a return visit to the
      first, and remembers when a customer's been told their requested day
      went by.
- [ ] **Storage:** after running the schema, check there's a private
      bucket called `job-files` (photos and certificates) next to
      `chat-attachments`. The schema makes it; leave it private.
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
- [ ] **Opening hours** (Settings → Opening hours, in the app or on the
      website; 8am to 8pm every day until changed, in half hours). Calls
      to the number ring Fergal's mobile (07448 628 101, or each admin's
      saved mobile), showing the caller's number, only while open.
      Outside them they go straight to voicemail ("Our phones are open
      from 8am to 8pm", or whatever's set), and the voicemail waits in
      their chat for the morning without a notification. Not answered in 18
      seconds: MPE's voicemail. Either way the call's logged in their chat.
      On their first ever call they get one text pointing them at the app
      and live chat (never again to that number, and not if they have the
      app): the moment Fergal answers, so he can ask them to install it
      while they're talking, or straight away if it's missed. For a caller
      with no email or app, Fergal also gets a notification as it rings,
      reminding him to ask.
- [ ] **Out of hours** for the chat too (the same opening hours):
      nobody's notified of a customer's message while closed. When you
      open, the team get one summary ("3 new messages since 8pm: Sam, Jo
      and 07700 900123"). A website chat while closed gets an automatic
      reply that the team are on the chat during the opening hours, with
      the gas emergency number (0800 111 999). Any chat left unanswered
      for two hours while open (counted from opening for overnight ones)
      reminds the team once.
- [ ] **Plan members' call-outs are free, and said so:** a signed-in member
      sees "You're on the MPE maintenance plan, so your call-out's free" on
      the call-out form instead of the £50; their booking confirmation says
      "Your call-out's free with your MPE maintenance plan"; and Fergal sees
      "Plan member · free call-out" on their request, job card and job.
- [ ] **Paying the call-out ahead:** a booked call-out's confirmation
      (email, app and message), visit page and job card in the app offer
      "Pay the £50 call-out now" (Apple Pay, Google Pay or card), "or pay
      your engineer on the day". Not for plan members or return visits.
      Nothing's charged until they tap it, and one started and left isn't
      chased. Fergal sees it paid on the job, and the invoice for the
      repair takes it off. If the visit's cancelled, it counts for their
      next one (or refund it in Stripe).
- [ ] Booking from the app (Book a call-out, Book a service, the
      services list): the form opens signed in, so someone signed in to
      the app sees "Booking as Sam Taylor, 12 Park Avenue…" with Change,
      and the booking always lands on their account. Its thank-you says
      updates come in the app, with **Back to the app** (mpe://jobs).
- [ ] The chat's details card asks for their name, postcode (optional),
      email and mobile. A reply email's button opens the chat as it was on
      the same device; on another, it asks for their email and sends a
      sign-in link that opens their conversation.
- [ ] Customers who've only phoned (no email, no app): booking them in
      asks for their email first. If they still have neither, the app
      offers **Open in WhatsApp Business**, with the message ready, for
      their booking (and any move or cancellation), "on my way", "running
      late", a quote, an invoice or payment link, and a receipt. In their
      chat, messages go from WhatsApp Business too.
- [ ] **One text only:** the automatic one after a customer's first call
      (pointing them at the app and live chat), and never again to that
      number. Everything else goes by the app and email, or WhatsApp
      Business for someone with neither. The chat can't send texts.
- [ ] **The £30 allowance** (excluding VAT): every call minute and text
      is logged and priced at Twilio's UK rates, at a fixed exchange rate,
      and checked every 30 minutes against Twilio's own month total (the
      higher one counts), using the same Twilio keys. Admins get a
      notification at every £5 up to £30, then every £5 over, with the
      amount over and the expected overage for the month. The Menu's
      "Calls and texts" card and **Settings → Calls and texts** show the
      month so far, the breakdown and the prices. By default calls and
      texts carry on after £30; the overage goes on Fergal's next
      Kanvas One invoice (billed outside this site). In Settings he can
      choose to pause once it's used: callers then hear a message pointing
      them to the app and website, and no texts go out, until the 1st.
- [ ] Put the prices from **Settings → Calls and texts** in the terms
      and conditions. If Twilio's prices change, update `RATES_USD` in
      `src/lib/twilio-usage.ts`.
- [ ] Optional, as a backstop: in the Twilio console, **Monitor → Usage
      triggers**, add one at about $40 to email you if something runs away.
- [ ] Customers reach MPE by **call, live chat or email**: the site and
      the app don't show WhatsApp. (Until live chat's switched on, the
      site's chat links are email links.)
- [ ] Optional: **WhatsApp Business on the MPE number**, for engineers who
      want to call customers on WhatsApp (free, and outside the
      allowance): in the WhatsApp Business app on Fergal's phone, register
      the MPE number and pick "Call me" for the code. Before you do, point
      the number's "A call comes in" webhook at
      `<site>/api/webhooks/twilio/voice?mode=forward` so the code call
      rings straight through; put it back after.
- [ ] Then in WhatsApp Business (Settings → Business tools), turn on a
      **greeting message** and an **away message** pointing customers to
      live chat in the MPE app (`<site>/app`) for a quicker reply, so job
      chat stays in the app where the rest of the job is.
- [ ] Once it's working, show it everywhere instead of Fergal's own number:
      set `NEXT_PUBLIC_MPE_PHONE` on the site and `EXPO_PUBLIC_MPE_PHONE`
      for the app build (both as `+44…`), and redeploy.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Console home (`AC…`) | Config |
| `TWILIO_AUTH_TOKEN` | Console home. Always needed: it checks Twilio's webhooks are real | **Secret** |
| `TWILIO_PHONE_NUMBER` | The number, as `+447…` | Config |
| `TWILIO_API_KEY_SID` | Optional: the API key (`SK…`) | Config |
| `TWILIO_API_KEY_SECRET` | Optional: the API key's secret | **Secret** |
| `NEXT_PUBLIC_MPE_PHONE` | The same number: the site shows it instead of Fergal's | Public |
| `TWILIO_ALLOWANCE_PENCE` | Optional: the month's calls and texts allowance, excluding VAT (default 3000, £30) | Config |
| `TWILIO_USD_TO_GBP` | Optional: the fixed exchange rate for Twilio's dollar prices (default 0.79) | Config |
| `OUTBOUND_CALLS_ON` | Leave unset. `0` switches off calls out from the Twilio number | Config |

**Check:** text the number; it appears in the team inbox. Ring it: Fergal's
phone rings with your number. Answer, then hang up: you get the "get the
MPE app" text. Ring again and don't answer: voicemail, and no second text.

Calls from the app: once the number's set, the team's Call buttons offer
**Call (uses call allowance)**: the engineer's phone rings first, and when
they answer they're put through; the customer sees the Twilio number. The
minutes come out of the £30 allowance, and it's hidden while calls and
texts are paused. Then **Call using WhatsApp** (opens their WhatsApp chat)
and **Use my own phone**. The phone that rings first is 07448 628 101,
unless an engineer saves their own mobile (Call → "Ring my own mobile
instead"). Until the number's set, Call dials from the engineer's own phone.

**Check:** in the app, open a chat with your own number and tap Call →
Call (uses call allowance). 07448 628 101 rings; answer it and your phone
rings showing the Twilio number. Settings → Calls and texts shows the
minutes a few seconds after you hang up.

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
- [ ] For Tap to Pay in the app: **Terminal → Locations → New**, MPE's
      address. Its id (`tml_…`) goes in `STRIPE_TERMINAL_LOCATION`.
- [ ] Optional, a **Bluetooth card reader** as well as Tap to Pay: order a
      Stripe Reader M2 or BBPOS WisePad 3 from **Terminal → Hardware
      orders**, then **Terminal → Readers → Register** it to the same
      location. In the app, Payment → Card reader finds it when it's switched
      on near the phone (Bluetooth on). Nothing else to set up.
- [ ] Re-run `supabase/schema.sql` (section 1) after this update: it lets
      an invoice be paid in parts (some cash, the rest by card) and by a
      card reader.

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | **Developers → API keys**, secret key (`sk_live_…`) | **Secret** |
| `STRIPE_WEBHOOK_SECRET` | The webhook's signing secret (`whsec_…`) | **Secret** |
| `STRIPE_TERMINAL_LOCATION` | The Terminal location id (`tml_…`), for Tap to Pay and the card reader in the app | Config |
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
on the phone number) and **Lead** (a booking form sent, from
the browser and the server, counted once).

## 8. The app (mobile/): before it's published

The app's code is ready. These are the accounts, switches and forms it
needs, in order. `mobile/README.md` has how to run and build it.

### Apple (iPhone)

- [ ] **A D-U-N-S number for MPE's limited company.** Apple and Google
      both use it to check the company is real before it can publish.
      It's free: look the company up at developer.apple.com/enroll/duns-lookup
      and request one if it hasn't got one (it can take a few days, and up
      to a couple of weeks to reach Apple). The company's details must
      match Companies House exactly.
- [ ] **Apple Developer Program, as an organisation in MPE's name**
      (developer.apple.com/programs, with the D-U-N-S number). Apple
      rejects apps a business publishes from someone else's account
      (guideline 4.2.6). Enrol as someone with authority to sign for the
      company (Fergal, as a director), using an Apple ID with two-factor
      authentication on. The App Store then shows the company's name.
- [ ] **App Store Connect → Users and Access:** add whoever uploads the
      builds (you) as App Manager, so Fergal doesn't have to.
- [ ] **Certificates, Identifiers & Profiles:** the first `eas build`
      makes the App ID `uk.co.mpenortheast.app`. Check it has **Push
      Notifications** and **Associated Domains** ticked.
- [ ] **Push notifications:** run `npx eas credentials` in `mobile/`. It
      makes Apple's push key (.p8) and gives it to Expo. Nothing goes to
      Stripe.
- [ ] **Tap to Pay on iPhone:** the account holder requests it at
      developer.apple.com/tap-to-pay. Apple grants a development
      entitlement first (for testing on your phones). The publishing one
      follows once Apple has reviewed the payment screens against its
      Tap to Pay guidelines (Stripe's Tap to Pay docs walk through what it
      asks for). Then set `TAP_TO_PAY_ENTITLEMENT=1` for the app's builds.
      It needs an iPhone XS or newer.
- [ ] **Apple Pay: nothing to set up in Apple.** Customers pay on
      Stripe's own checkout page, which the app opens in its in-app
      browser, and Apple Pay works there as soon as it's on in Stripe
      (section 5). No Merchant ID or Apple Pay certificate is needed, and
      Tap to Pay doesn't need one either. (Only if the app ever takes
      payments in a native payment sheet instead: make a Merchant ID
      `merchant.uk.co.mpenortheast.app`, then in Stripe → Settings →
      Payment methods → Apple Pay → Add new application, download Stripe's
      certificate request, upload it to that Merchant ID's "Apple Pay
      Payment Processing Certificate", and upload Apple's `.cer` back to
      Stripe.)
- [ ] **App Store Connect → New app:** name MPE, bundle ID
      `uk.co.mpenortheast.app`. Then:
  - [ ] Privacy policy URL `<site>/privacy`, support URL `<site>/contact`.
  - [ ] **App Privacy:** contact details (name, email, phone), user
        content (chat messages and photos), and a user ID, all linked to
        them and used for the app working, none for tracking. Payments
        are taken by Stripe.
  - [ ] Age rating questionnaire, category (Business or Lifestyle),
        screenshots (6.9-inch iPhone at least) and the description.
  - [ ] Encryption: already answered in the app (`usesNonExemptEncryption`
        is false).
- Sign in with Apple isn't needed: the app only signs in by email.
- Delete account is already in the app, as Apple requires.

### Google (Android)

- [ ] **Google Play Console account as an organisation** in MPE's name
      (one-off fee), with the same D-U-N-S number. (A personal account
      would have to run a closed test with 12 testers for 14 days first;
      an organisation account doesn't.)
- [ ] **Push notifications:** a Firebase project → Project settings →
      Service accounts → generate a key, then upload it in expo.dev → the
      project → Credentials → Android → FCM V1.
- [ ] **Data safety form:** the same answers as Apple's App Privacy.
- [ ] **Account deletion link:** Google asks for a web page about deleting
      an account: give it `<site>/delete-account` (signed in, it has the
      button; signed out, it says how).
- [ ] Tap to Pay on Android needs no extra permission from Google: an
      NFC phone on Android 11 or newer, and Stripe's location (section 5).

### Expo (builds)

- [ ] Make an account at expo.dev, then in `mobile/` run `npx eas init`:
      the project id is `EAS_PROJECT_ID`.
- [ ] Set the app's variables (table below) in expo.dev → the project →
      Environment variables.
- [ ] `npx eas build --platform all`, then `npx eas submit` to send each
      build to the stores.

### The website, once the app's live

- [ ] Resend is set up (section 2): the app's "Confirm my email" sign-in
      email comes from it.
- [ ] Stripe's Terminal location is set (section 5), for Tap to Pay.
- [ ] Set the variables below and redeploy. Until `APPLE_TEAM_ID` and
      `ANDROID_CERT_SHA256` are set, links in emails and texts open the
      website, and "Confirm my email" opens the website's confirm page,
      which then hands back to the app.

### Last, just before sending it to Apple

- [ ] **A review login for Apple:** reviewers can't open a customer's
      email, so one address signs in with a password instead.
  - [ ] Supabase → Authentication → Users → Add user: an address like
        `appreview@<your domain>` with a password.
  - [ ] Set that address as `APP_REVIEW_EMAIL` on the website.
  - [ ] Put both in App Review's notes, and say Take payment (Tap to Pay)
        is only shown to MPE's own engineers.

On the website (Vercel):

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_STORE_URL` | The App Store listing | Public |
| `NEXT_PUBLIC_PLAY_STORE_URL` | The Google Play listing | Public |
| `APPLE_TEAM_ID` | developer.apple.com → Membership: the 10-character Team ID | Config |
| `ANDROID_CERT_SHA256` | Play Console → the app → App integrity → App signing: the SHA-256 fingerprint (several, comma-separated) | Config |
| `APP_REVIEW_EMAIL` | The App Review login's address (above) | Config |

In the app's builds (expo.dev → the project → Environment variables):

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `EXPO_PUBLIC_SITE_URL` | The website's address, e.g. `https://mpenortheast.co.uk` | Public |
| `EXPO_PUBLIC_SUPABASE_URL` | The same as `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys: the **publishable** key (`sb_publishable_…`) | Public |
| `EAS_PROJECT_ID` | expo.dev → the project | Config |
| `TAP_TO_PAY_ENTITLEMENT` | `1`, only once Apple has granted Tap to Pay | Config |
| `EXPO_PUBLIC_TAP_TO_PAY_SIMULATED` | `1` to test Tap to Pay with Stripe's pretend card (test keys only) | Config |

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
