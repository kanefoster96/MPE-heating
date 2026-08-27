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
    layout.tsx        Root layout, fonts, metadata
    page.tsx           Homepage — assembles all sections
    globals.css         Design tokens (colour palette, font) + base styles
  components/
    Nav.tsx             Sticky nav with call button + mobile menu
    PromoStrip.tsx       Offer banner
    Hero.tsx             Hero block + booking card
    AccreditationStrip.tsx
    ServiceCards.tsx     6 service cards (repair, servicing, new boilers, plumbing, electrics, landlords)
    WhyMpe.tsx
    HowItWorks.tsx
    GuaranteeBlock.tsx
    Reviews.tsx           Swipeable review rail
    Faq.tsx                Homes/Commercial tabs + accordion
    CommercialTeaser.tsx
    AreasCovered.tsx
    FinalCta.tsx
    Footer.tsx
    FloatingWhatsapp.tsx  Fixed WhatsApp button
    StickyMobileBar.tsx    Fixed mobile call/book bar
    ProductArt.tsx         Shared "flat-colour panel + icon" illustration wrapper
    icons.tsx               Inline SVG icon set
```

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
