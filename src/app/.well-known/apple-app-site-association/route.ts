import { appleAppSiteAssociation } from "@/lib/app-links";

/**
 * Apple's Universal Links file: which of the site's links open the MPE app
 * on an iPhone that has it (src/lib/app-links.ts has the list and why).
 * Apple is strict about it: exactly this address, no ".json", no
 * redirect, JSON, a 200. Until APPLE_TEAM_ID is set it answers 404, which
 * Apple reads as "no links for this app", so links keep opening the site.
 */
export const dynamic = "force-static";

export function GET() {
  const body = appleAppSiteAssociation();
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
