import { forwardToAdmins, handleIncomingCall, readTwilioRequest, twiml } from "@/lib/missed-calls";

/** The Twilio number's "A call comes in" webhook — see lib/missed-calls.ts (and forwardToAdmins for ?mode=forward). */
export async function POST(request: Request) {
  const params = await readTwilioRequest(request);
  if (!params) return twiml("", 403);
  // Pointing the number at ?mode=forward rings the admins' phones instead.
  if (new URL(request.url).searchParams.get("mode") === "forward") return forwardToAdmins();
  return handleIncomingCall(params.From);
}
