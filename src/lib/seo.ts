import { business, services, type ServicePage, type FaqItem } from "./content";

// Single source of truth for the production URL. Update SITE_URL (or set
// NEXT_PUBLIC_SITE_URL) once the real domain is pointed at this deployment
// — mpenortheast.co.uk is used as the default since it's already the
// business's email domain, but confirm before launch.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://mpenortheast.co.uk";

const phoneE164 = `+44${business.phoneHref.replace("tel:0", "")}`;

// schema.org LocalBusiness (+ the more specific Plumber/Electrician/
// HVACBusiness subtypes, since MPE covers all three trades) — rendered
// once in the root layout so it's present on every page. No `address` is
// published: MPE is a service-area business, not a storefront, and
// schema.org/Google's own guidance for SABs is to describe areaServed
// instead of a precise address. No aggregateRating/review markup either —
// the testimonials in content.ts (`reviews`) are placeholder example copy
// from the initial design brief, not verified real customer reviews, and
// marking them up as structured review data would misrepresent them to
// search engines. Swap in real reviews (and add AggregateRating) once
// there are some to point at.
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["HVACBusiness", "Plumber", "Electrician"],
    name: business.fullName,
    alternateName: business.name,
    image: `${SITE_URL}/mpe-logo.png`,
    url: SITE_URL,
    telephone: phoneE164,
    email: business.email,
    description:
      "Gas Safe registered boiler repairs, servicing, new boiler installs, plumbing and electrics across the North East of England. Same-day response, £50 call-out refunded when fixed, 30-day guarantee.",
    areaServed: business.areasList.map((name) => ({ "@type": "City", name })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: s.eyebrow,
          description: s.line,
        },
        // Only servicing has a genuine fixed starting price today — the
        // others are quote/diagnosis-based, so no price is stated rather
        // than guessed.
        ...(s.id === "servicing"
          ? { priceSpecification: { "@type": "PriceSpecification", minPrice: 79, priceCurrency: "GBP" } }
          : {}),
      })),
    },
  };
}

export function serviceJsonLd(page: ServicePage) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: page.eyebrow,
    name: page.headline,
    description: page.subline,
    url: `${SITE_URL}/${page.slug}`,
    areaServed: business.areasList.map((name) => ({ "@type": "City", name })),
    provider: {
      "@type": "HVACBusiness",
      name: business.fullName,
      telephone: phoneE164,
      url: SITE_URL,
    },
  };
}

export function faqPageJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
