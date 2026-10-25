import { finishCall, readTwilioRequest, twiml } from "@/lib/missed-calls";

/** Where the voicemail prompt goes once the caller stops talking or hangs up. */
export async function POST(request: Request) {
  if (!(await readTwilioRequest(request))) return twiml("", 403);
  return finishCall();
}
