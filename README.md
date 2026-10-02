# MPE Heating & Plumbing — Website

Homepage for MPE, a domestic (and commercial) boiler repair, servicing, plumbing
and electrics company in the North East. Built with Next.js (App Router),
TypeScript and Tailwind CSS v4.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS v4** — design tokens (colours, font) live in `src/app/globals.css`
- **Outfit** — geometric sans-serif from Google Fonts, loaded via `next/font`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run lint    # eslint
```

## Editing site content

Business details, copy, service cards, FAQs, reviews and links are centralised
in **`src/lib/content.ts`** — update phone number, Gas Safe registration number,
service copy, review quotes etc. there rather than in the components.

## Structure

```
src/
  app/
    layout.tsx           Root layout, fonts, metadata, LocalBusiness JSON-LD
    page.tsx              Homepage — assembles all sections
    globals.css            Design tokens (colour palette, font) + base styles
    boiler-repair/ servicing/ new-boilers/ commercial/   Service pages
    areas/                 Areas index + one page per town (src/lib/areas.ts)
    help/                  Advice articles (src/lib/help.ts)
    faqs/ about/ privacy/ terms/
    contact/               Booking & quote form (ContactForm.tsx)
    api/contact/           Form delivery route — emails the enquiry via Resend
  components/              Nav, Hero, section blocks, Footer, icon set
  lib/
    content.ts             All editable copy and business details
    enquiry.ts             Enquiry types the contact form accepts
    seo.ts                 SITE_URL + JSON-LD builders
```

## Contact form delivery

The booking/quote form posts to `/api/contact`, which emails the enquiry via
[Resend](https://resend.com). Set `RESEND_API_KEY` (and optionally
`CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL`) in Vercel — see `.env.example`.
Until the key is set, the form shows a call/WhatsApp fallback rather than a
false "sent" message.

## Imagery

There is no product/site photography yet, so every illustration is a flat-colour
panel with a line icon and soft shadow (`ProductArt`), standing in for the real
photo cut-outs described in the design brief (boiler shots, van, engineer on
site, etc.). Swap these for real photography before launch — search for
`ProductArt` usages to find every spot.

## Placeholder business details

Phone number, WhatsApp number, email and Gas Safe registration number in
`src/lib/content.ts` are placeholders — update with the real details before
going live.
