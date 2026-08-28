import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// A plain `Allow: /` for every user-agent already covers standard search
// crawlers and the AI ones (GPTBot, ClaudeBot, PerplexityBot,
// Google-Extended, etc.) — no need to enumerate them individually unless
// we wanted to block one, which we don't. /api/ is disallowed since
// there's nothing there worth indexing (just the address-lookup route).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
