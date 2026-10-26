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
  chat.
- **Services** (`app/(tabs)/services.tsx`): every service with its price
  and Book, and the maintenance plan.
- **The orange button** in the middle: the call-out request. For the team,
  Take payment (`app/take-payment.tsx`), with Tap to Pay.
- **Chat** (`app/(tabs)/chat.tsx`, `components/chat-thread.tsx`): the
  customer's chat with the team, photos from the camera or library,
  live. The team see their inbox instead, and reply by chat, text or
  email (`app/chat/[id].tsx`).
- **Jobs**: says "coming next" until it's built.
- **Bell** (`app/notifications.tsx`): what's waiting on them (an invoice
  to pay, a quote, a plan payment that failed) and what's coming up. For
  the team, new bookings and requests.
- **Account** (`app/account.tsx`): their visits, invoices, certificates,
  plan, cards and boiler (the website's account page, opened signed in),
  Sign out and Delete account. The team get their tools here.
- **Sign in** (`app/sign-in.tsx`): their email, then a 6-digit code. No
  password. Nobody has to sign in to book or chat.

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
- Tap to Pay on the team's phones (`components/tap-to-pay.native.tsx`).
- Pull to refresh, grey loading boxes, and screens that fade in.

## Before the App Store

See `docs/setup-checklist.md` section 8: MPE's own Apple Developer
account, the Expo project, push keys, the Tap to Pay entitlement, and a
test login for Apple's reviewers.

The app icon (`assets/icon.png`) is the full MPE logo on white for now. A
square version of the mark, designed for small sizes, would look better
on the home screen.
