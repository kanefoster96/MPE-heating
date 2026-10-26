# MPE app

The MPE customer app (Expo, iOS and Android). It reads the website's own
copy and prices from `/api/mobile/*` on the site, so a change on the site
shows in the app without a new build.

## Run it

```bash
cd mobile
npm install
npm start          # scan the QR code with Expo Go
npm run web        # or open it in a browser
```

By default it talks to https://mpe-heating.vercel.app. To point it at a
site running on your computer, set `EXPO_PUBLIC_SITE_URL`:

```bash
EXPO_PUBLIC_SITE_URL=http://localhost:3000 npm run web
```

When the domain is live, change the default in `lib/site.ts`.

## What's here

- **Home** (`app/(tabs)/index.tsx`): the call-out at the top (request,
  call, WhatsApp, the £50 explained), every service with its price and
  Book, the maintenance plan, then the help guides.
- **Guides** (`app/guide/[slug].tsx`): the website's help articles, read
  in the app.
- **Call-out** (the orange button in the middle of the tab bar): opens the
  call-out request form.
- **Jobs, Chat, Account**: say "coming next" until they're built.

Booking forms open in an in-app browser sheet, so the app and the site
always take the same bookings.

## Before the App Store

- MPE's own Apple Developer account (Apple rejects apps published for a
  business from someone else's account).
- In-app account creation and account deletion, once Account is built.
- A demo account for Apple's reviewers.
