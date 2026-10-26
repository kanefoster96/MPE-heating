# MPE app

The MPE customer app (Expo, iOS and Android), and the team's tools when
Fergal or an engineer signs in. It reads the website's own copy and
prices from `/api/mobile/*` on the site, so a change on the site shows in
the app without a new build.

## Run it

```bash
cd mobile
npm install
npm start          # scan the QR code with Expo Go
npm run web        # or open it in a browser
```

Expo Go and the browser show everything except Tap to Pay and push
notifications, which need a real build (`npx eas build`).

Settings come from environment variables (`docs/setup-checklist.md`
section 8 lists them all). With none set, the app talks to
https://mpe-heating.vercel.app and works as a brochure: sign-in and chat
say they're coming soon. To point it at a site on your computer:

```bash
EXPO_PUBLIC_SITE_URL=http://localhost:3000 npm run web
```

After changing an `EXPO_PUBLIC_` variable, start with `--clear` so it's
picked up.

## What's here

- **Top bar** (`components/top-bar.tsx`): their picture on the left
  (sign in, or their account), the MPE logo, and the bell on the right.
- **Home** (`app/(tabs)/index.tsx`): book a call-out or a service, three
  more services and All services, the help guides with a search, and live
  chat. The team get their day instead (`components/team-home.tsx`): the
  next job with its buttons, the rest of today, the week (tap a day to
  open it in Jobs), Take payment and Add a visit (plus New invoice and New
  quote for admins), and anything that needs them from the Menu.
- **Services** (`app/(tabs)/services.tsx`): every service with its price
  and Book, and the maintenance plan.
- **The orange button** in the middle: the call-out request. For the team,
  their Jobs; the last tab is then Payment (`app/take-payment.tsx`), every
  open invoice with Tap to Pay.
- **Chat** (`app/(tabs)/chat.tsx`, `components/chat-thread.tsx`): the
  customer's chat with the team, photos from the camera or library,
  live. The team see their inbox instead, laid out as Kanvas Academy's:
  the big "Inbox" title, search edge to edge with the filter (All, Unread,
  Open, Done) at its end, the team chat pinned as a card, then everyone,
  newest first, with a phone on the avatar of anyone writing from the app;
  swipe left to mark one done. A conversation (`app/chat/[id].tsx`) has
  the Academy's header (their name and how they last got in touch, round
  Call and Done buttons) and composer: the message full width, then send
  as Live chat, Text or Email, the "+" (book a visit, invoice or call-out
  fee, take a payment, start a quote, send a photo) and Send
  (`components/action-sheet.tsx`); and the name at the top opens the
  customer (`app/customer/[id].tsx`): call, chat, directions, jobs
  underway (each opens its job page to move, finish or take payment),
  what they owe, quotes, the team's notes (and a new one), their boiler,
  and what's been done before. Someone chatting who isn't a customer yet
  is added from the chat first.
- **Jobs** (`app/(tabs)/jobs.tsx`): a customer's jobs, each with its
  steps (requested, booked, on the way, done, paid), today's as a green
  card, and their previous jobs underneath. For the team, the day's
  visits on a fortnight strip, with Call, Directions, Chat, On my way,
  Not in, Finish and Take payment. Tapping a visit opens its page
  (`app/job/[id].tsx`): what's been asked for and paid, the customer's
  other unpaid invoices, and Payment stuck to the bottom. Payment
  (`components/payment-sheet.tsx`, also from the Payment tab) asks what
  it's for (this job's open invoices first, then their others; one not on
  a job yet goes on this one), then: Tap to Pay or a Bluetooth card reader
  (recorded automatically), their saved card once he's checked with them,
  the payment link to their chat, text and email (Apple Pay from there),
  or cash, all of it or part, with the rest taken by card or the link
  (`src/lib/app-payments.ts` on the site).
- **Calendar** (`app/calendar.tsx`): the month with a dot per visit
  (orange for a request) and days off greyed; pick a day for its visits.
  **Add a visit** (`app/visit-form.tsx`): find the customer or add a new
  one, the kind, the day, morning/afternoon/all day or exact times, where,
  notes, and "Let them know". The same form moves a visit or books a
  request. On a job's page: book a request as asked or pick another time,
  move it where they asked or keep the time, send the details again,
  cancel (telling them or not) or remove (`src/lib/app-schedule.ts`).
- **Finish job** (`app/finish/[id].tsx`): what was done (the customer sees
  it), their boiler, serviced today, a private note for next time, the
  summary and the review ask, and photos and certificates for the job from
  the camera, photos or a PDF (`components/file-adder.tsx`, straight to
  the private job-files storage). Opened again, it edits what was saved.
- **New invoice or call-out fee** (`app/new-payment.tsx`): the call-out
  fee (not for plan members), and the invoice: lines, his products as
  one-tap lines, the call-out fee they paid taken off, referral money off,
  extras offered on their pay page, and paying monthly. Then send it to
  them, or take payment now on the Payment sheet. **Invoices**
  (`app/invoices.tsx`, `app/invoice/[id].tsx`): unpaid, monthly and paid,
  each with what's left; take it, send the link or receipt again, cancel,
  record a monthly payment, stop or restart monthly payments. **New
  customer** and their details (`app/customer-form.tsx`).
- **Quotes** (`app/quotes.tsx`, `app/new-quote.tsx`, `app/quote/[id].tsx`):
  waiting, accepted (to do) and the last 90 days; writing one (lines,
  products, what's included, a deposit, how long it's open, the rest
  monthly); and on one: send it again, withdraw it, book the work in,
  invoice the rest.
- **Customers** (`app/customers.tsx`): everyone, with a search, and New
  customer. A customer's page (`app/customer/[id].tsx`) also has their
  maintenance plan (send it, cancel it at the end of what's paid for or
  today, keep it going) and their photos and certificates (add, show them
  or hide them, delete). **Maintenance plan** (`app/plan.tsx`): members,
  what it brings in, failed payments and who's leaving. **Days off**
  (`app/days-off.tsx`). **Settings** (`app/settings.tsx`, admins): plan
  prices, referral rewards, the Google review link, products and the two
  offered at repairs (`src/lib/app-business.ts` on the site).
- **Menu** (`app/(tabs)/menu.tsx`, the team only, in Services' place):
  cards that turn orange when something needs Fergal (requests, unread
  messages, overdue invoices, failed monthly or plan payments, accepted
  quotes to book in, certificates running out) and green when it's in
  order, then every tool, all in the app: Finance (`app/finance.tsx`),
  Metrics (`app/metrics.tsx`), Certificates (`app/certificates.tsx`) and
  the rest above. Nothing the team does needs the website, and a link to
  one of its team pages (in a push, an email or a text) opens the app's
  own screen (`lib/links.ts`). Money is for admins only.
- **Bell** (`app/notifications.tsx`): what's waiting on them (an invoice
  to pay, a quote, a plan payment that failed) and what's coming up. For
  the team, new bookings and requests.
- **Account** (`app/account.tsx`): their visits, invoices, certificates,
  plan, cards and boiler (the website's account page, opened signed in),
  Sign out and Delete account. The team get a link to their Menu.
- **Sign in** (`app/sign-in.tsx`, `app/app-sign-in.tsx`): their email,
  then a "Confirm my email" button in the email. Tapped on the phone, it
  opens the app signed in. No code to type and no password
  (`src/lib/app-sign-in.ts` on the site). Nobody has to sign in to book or
  chat.

Booking forms and payment pages open in an in-app browser sheet, so the
app and the site always take the same bookings and payments.

## Native features

- A light tap (haptics) on every press, a "done" when a message sends or
  a payment's taken, and a warning when something didn't go through.
- Push notifications for chat replies, visits, invoices and quotes,
  asked for after their first message or when they sign in. The number
  on the app icon is unread chat plus things waiting.
- Links in MPE's emails and texts (pay, quote, visit, plan, chat,
  account, help guides) open the app when it's installed
  (`app/+native-intent.tsx`, `lib/links.ts`).
- Tap to Pay on the team's phones, or a Bluetooth card reader
  (`components/tap-to-pay.native.tsx`).
- Pull to refresh, grey loading boxes, and screens that fade in.

## Before the App Store

See `docs/setup-checklist.md` section 8: MPE's own Apple Developer
account, the Expo project, push keys, the Tap to Pay entitlement, and a
test login for Apple's reviewers.

The app icon (`assets/icon.png`) is the full MPE logo on white for now. A
square version of the mark, designed for small sizes, would look better
on the home screen.
