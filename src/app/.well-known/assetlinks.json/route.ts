import { androidAssetLinks } from "@/lib/app-links";

/**
 * Android's App Links file: vouches that the MPE app is the site's own, so
 * the links in its intent filter open the app without asking (see
 * src/lib/app-links.ts). 404 until ANDROID_CERT_SHA256 is set.
 */
export const dynamic = "force-static";

export function GET() {
  const body = androidAssetLinks();
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
