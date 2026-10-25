import { handleTranscription, readTwilioRequest } from "@/lib/missed-calls";

/** Twilio's "transcript ready" callback for a voicemail. */
export async function POST(request: Request) {
  const params = await readTwilioRequest(request);
  if (!params) return new Response(null, { status: 403 });
  try {
    await handleTranscription(new URL(request.url).searchParams.get("c"), params);
  } catch (err) {
    console.error("voicemail: transcription callback failed", err);
  }
  return new Response(null, { status: 204 });
}
