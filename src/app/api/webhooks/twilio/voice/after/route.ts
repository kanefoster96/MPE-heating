import { handleAfterDial, readTwilioRequest, twiml } from "@/lib/missed-calls";

/** The Dial's action: Fergal's phone stopped ringing (answered, or not), see lib/missed-calls.ts. */
export async function POST(request: Request) {
  const params = await readTwilioRequest(request);
  if (!params) return twiml("", 403);
  const q = new URL(request.url).searchParams;
  const from = q.get("from");
  return handleAfterDial(q.get("c"), from && from.startsWith("+") ? from : null, params, q.get("out") === "1");
}
