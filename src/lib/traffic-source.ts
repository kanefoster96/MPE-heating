/**
 * Turns where a visit started (lib/first-touch.ts) into labels the team can
 * read on a job: the source, paid or not, and which campaign and advert.
 * From Kanvas Academy's lib/analytics.ts. Pure, no server imports, so the
 * booking form can use it in the browser.
 */

/**
 * Order matters: an AI assistant on a search engine's domain
 * (gemini.google.com) would otherwise match the search engine, and
 * answering a question in a chat window isn't the same channel as a search
 * result. So the assistants come first.
 */
const SOURCE_HOST_PATTERNS: [RegExp, string][] = [
  [/(^|\.)chatgpt\.|(^|\.)openai\./, "ChatGPT"],
  [/^gemini\.google\.|(^|\.)bard\.google\./, "Gemini"],
  [/^copilot\.microsoft\.|(^|\.)copilot\./, "Copilot"],
  [/(^|\.)perplexity\./, "Perplexity"],
  [/(^|\.)claude\.ai$|(^|\.)anthropic\./, "Claude"],

  [/(^|\.)google\./, "Google"],
  [/(^|\.)(facebook|fb|instagram)\./, "Facebook / Instagram"],
  [/(^|\.)bing\./, "Bing"],
  [/(^|\.)duckduckgo\./, "DuckDuckGo"],
  [/(^|\.)tiktok\./, "TikTok"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)ecosia\./, "Ecosia"],
  [/(^|\.)(youtube|youtu)\./, "YouTube"],
  [/(^|\.)(twitter|x)\.com$|(^|\.)t\.co$/, "X / Twitter"],
  [/(^|\.)whatsapp\./, "WhatsApp"],
  [/(^|\.)linkedin\.|(^|\.)lnkd\./, "LinkedIn"],
  [/(^|\.)reddit\./, "Reddit"],
  [/(^|\.)nextdoor\./, "Nextdoor"],
];

/**
 * A readable source: an explicit utm_source wins (an advert's link should
 * say what it is), then the click ids only ever found on paid advert links,
 * then the referring site, then "Direct" for no referrer at all (typed in,
 * a bookmark, or an app that hides where it came from).
 */
export function parseTrafficSource(referrer: string, search: string): string {
  const params = new URLSearchParams(search);

  const utmSource = params.get("utm_source");
  if (utmSource) return utmSource.charAt(0).toUpperCase() + utmSource.slice(1);

  if (params.has("fbclid")) return "Facebook / Instagram";
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "Google Ads";

  if (!referrer) return "Direct";

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    for (const [pattern, label] of SOURCE_HOST_PATTERNS) {
      if (pattern.test(host)) return label;
    }
    return host;
  } catch {
    return "Direct";
  }
}

/** Which campaign, where the link said: utm_campaign, else utm_content. Null for most organic visits. */
export function parseCampaign(search: string): string | null {
  const params = new URLSearchParams(search);
  const campaign = params.get("utm_campaign") || params.get("utm_content");
  return campaign?.trim().slice(0, 120) || null;
}

/**
 * Which advert within the campaign: utm_content, which a Meta ad can fill
 * with {{ad.name}}. Only when there's also a utm_campaign, since without
 * one parseCampaign has already used utm_content as the campaign.
 */
export function parseAd(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!params.get("utm_campaign")) return null;
  return params.get("utm_content")?.trim().slice(0, 120) || null;
}

/**
 * Paid or not. A utm_medium wins where the link has one; otherwise an
 * fbclid or gclid is proof they clicked an advert, since Meta and Google
 * add those themselves. Null means we don't know, which is the honest
 * answer for a search result or a typed address.
 */
export function parseMedium(search: string): string | null {
  const params = new URLSearchParams(search);

  const medium = params.get("utm_medium");
  if (medium) return medium.trim().toLowerCase().slice(0, 40);

  if (params.has("fbclid")) return "paid";
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) return "paid";

  return null;
}
