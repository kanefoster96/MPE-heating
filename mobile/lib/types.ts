/** What the site's /api/mobile/home sends (src/app/api/mobile/home/route.ts on the site). */
export type HomeData = {
  business: { name: string; fullName: string; phoneDisplay: string; phoneHref: string; whatsappHref: string; gasSafeNumber: string; base: string };
  callout: {
    title: string;
    em: string;
    text: string;
    cta: string;
    bookUrl: string;
    sameDay: string;
    steps: { title: string; text: string }[];
    foot: string;
    fee: string;
  };
  services: { id: string; title: string; headline: string; line: string; icon: ServiceIcon; price: string; bookUrl: string; moreUrl: string | null }[];
  plan: { title: string; headline: string; points: string[]; price: string | null; bookUrl: string };
  guides: GuideSummary[];
};

export type ServiceIcon = "boiler" | "service" | "newboiler" | "plumbing" | "electrics" | "landlord";

export type GuideSummary = { slug: string; title: string; description: string; category: string; readTime: string };

export type ContentBlock = { type: "p"; text: string } | { type: "h2"; text: string } | { type: "list"; items: string[] } | { type: "callout"; text: string };

export type Guide = GuideSummary & { content: ContentBlock[]; relatedService: { label: string; url: string }; webUrl: string };
