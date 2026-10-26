import { NextResponse } from "next/server";
import { mobileCaller, mobileJson, readJson } from "@/lib/mobile-api";
import { deliverCoachMessage } from "@/lib/coach-send";
import { sendCustomerMessage } from "@/lib/customer-send";
import type { ChatAttachmentType, ChatChannel, SendMessageInput } from "@/lib/chat";

const TYPES: ChatAttachmentType[] = ["image", "video", "file"];
const CHANNELS: ChatChannel[] = ["chat", "email", "sms"];

/**
 * Sends a message from the app: a customer into their own chat
 * (lib/customer-send.ts, the same as the website), or the team into any
 * conversation (lib/coach-send.ts, with email or text if they pick it).
 * A photo is uploaded first, straight to the chat-attachments bucket, and
 * its path sent here.
 */
export async function POST(request: Request) {
  const caller = await mobileCaller(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson<{ conversationId: string; body: string; channel: string; attachmentPath: string; attachmentType: string; attachmentName: string }>(request);

  const input: SendMessageInput = {
    body: typeof body.body === "string" ? body.body.slice(0, 4000) : "",
    attachmentPath: typeof body.attachmentPath === "string" ? body.attachmentPath : undefined,
    attachmentType: TYPES.includes(body.attachmentType as ChatAttachmentType) ? (body.attachmentType as ChatAttachmentType) : undefined,
    attachmentName: typeof body.attachmentName === "string" ? body.attachmentName.slice(0, 200) : undefined,
  };
  if (input.attachmentPath && !input.attachmentType) return mobileJson({ error: "Could not attach that file." }, 400);

  if (caller.staff && typeof body.conversationId === "string") {
    const channel = CHANNELS.includes(body.channel as ChatChannel) ? (body.channel as ChatChannel) : "chat";
    const result = await deliverCoachMessage({ user: caller.user, conversationId: body.conversationId, input: { ...input, channel } });
    if (!result.success) return mobileJson({ error: result.error }, result.status);
    return mobileJson({ ok: true, conversationId: body.conversationId });
  }

  const result = await sendCustomerMessage(caller.user, input, "app");
  if (!result.success) return mobileJson({ error: result.error }, 400);
  return mobileJson({ ok: true, conversationId: result.conversationId });
}
