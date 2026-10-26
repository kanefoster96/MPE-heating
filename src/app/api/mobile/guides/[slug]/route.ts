import { NextResponse } from "next/server";
import { getHelpArticle } from "@/lib/help";
import { CLUB_SITE_URL } from "@/lib/club";

/** One help guide for the MPE app, in the same blocks the website renders (lib/help.ts). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  const headers = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300, s-maxage=300" };
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
  const site = CLUB_SITE_URL.replace(/\/$/, "");
  return NextResponse.json(
    {
      ...article,
      relatedService: { label: article.relatedService.label, url: `${site}${article.relatedService.href}` },
      webUrl: `${site}/help/${article.slug}`,
    },
    { headers },
  );
}
