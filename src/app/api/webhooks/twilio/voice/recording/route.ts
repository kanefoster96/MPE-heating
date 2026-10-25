import { handleRecording, readTwilioRequest } from "@/lib/missed-calls";

/** Twilio's "recording ready" callback for a voicemail. */
export async function POST(request: Request) {
  const params = await readTwilioRequest(request);
  if (!params) return new Response(null, { status: 403 });
  try {
    await handleRecording(new URL(request.url).searchParams.get("c"), params);
  } catch (err) {
    console.error("voicemail: recording callback failed", err);
  }
  return new Response(null, { status: 204 });
}
