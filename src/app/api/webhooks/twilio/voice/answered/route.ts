import { handleAnswered, readTwilioRequest, twiml } from "@/lib/missed-calls";

/** Fergal picked up a call to the MPE number: the app text goes now, so he can mention it (lib/missed-calls.ts). */
export async function POST(request: Request) {
  const params = await readTwilioRequest(request);
  if (!params) return twiml("", 403);
  const q = new URL(request.url).searchParams;
  const from = q.get("from");
  await handleAnswered(q.get("c"), from && from.startsWith("+") ? from : null);
  return new Response(null, { status: 204 });
}
