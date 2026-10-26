import { NextResponse } from "next/server";
import { business, fee, hero, homeExtras, sameDay, services } from "@/lib/content";
import { helpArticles } from "@/lib/help";
import { CLUB_SITE_URL } from "@/lib/club";
import { planOpen, planPrices, priceLine } from "@/lib/maintenance-plan";

/**
 * The MPE app's Home screen (mobile/app/(tabs)/index.tsx): the call-out,
 * the services with their prices and where to book each, the maintenance
 * plan and the help guides. All of it is the website's own copy
 * (lib/content.ts, lib/help.ts), so a price changed on the site changes in
 * the app with no new build. Public and read-only, so open to any origin
 * (the app's web preview runs on another port).
 */

const SITE = CLUB_SITE_URL.replace(/\/$/, "");

/** Where each service is booked on the site, and its price as the site gives it. */
const BOOKING: Record<string, { book: string; price: string }> = {
  repair: { book: "/emergency", price: "£50 call-out" },
  servicing: { book: "/book/service", price: "From £79" },
  "new-boilers": { book: "/book/new-boiler", price: "Free quote" },
  plumbing: { book: "/book?path=plumbing", price: "Price agreed first" },
  electrics: { book: "/book?path=electrics", price: "Price agreed first" },
  landlords: { book: "/book?path=landlord", price: "Price agreed first" },
};

export async function GET() {
  const prices = await planPrices().catch(() => ({ monthPence: null, yearPence: null, minMonths: 0 }));
  const body = {
    business: {
      name: business.name,
      fullName: business.fullName,
      phoneDisplay: business.phoneDisplay,
      phoneHref: business.phoneHref,
      whatsappHref: business.whatsappHref,
      gasSafeNumber: business.gasSafeNumber,
      base: business.base,
    },
    callout: {
      title: hero.headline.lead,
      em: hero.headline.em,
      text: hero.subline,
      cta: "Request a call-out",
      bookUrl: `${SITE}/emergency`,
      sameDay: sameDay.callLine,
      steps: hero.callOut.rows,
      foot: hero.callOut.foot,
      fee: fee.short,
    },
    services: services.map((s) => ({
      id: s.id,
      title: s.eyebrow,
      headline: s.headline,
      line: s.line,
      icon: s.icon,
      price: BOOKING[s.id]?.price ?? "Price agreed first",
      bookUrl: `${SITE}${BOOKING[s.id]?.book ?? s.href}`,
      moreUrl: s.href.startsWith("/book") ? null : `${SITE}${s.href}`,
    })),
    plan: {
      title: homeExtras.plan.tag,
      headline: homeExtras.plan.title,
      points: homeExtras.plan.points,
      price: planOpen(prices) ? priceLine(prices) : null,
      bookUrl: `${SITE}${homeExtras.plan.href}`,
    },
    guides: helpArticles.map((a) => ({ slug: a.slug, title: a.title, description: a.description, category: a.category, readTime: a.readTime })),
  };
  return NextResponse.json(body, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
