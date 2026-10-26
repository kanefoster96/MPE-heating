import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { setConversationPhone } from "@/lib/app-chat";

/** Adds or corrects the number a conversation's "Text" option sends to (the website composer's Edit). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { conversationId, phone } = await readJson<{ conversationId: string; phone: string }>(request);
  if (typeof conversationId !== "string" || typeof phone !== "string") return mobileJson({ error: "Enter a number." }, 400);
  const result = await setConversationPhone(conversationId, phone);
  return result.ok ? mobileJson({ phone: result.phone }) : mobileJson({ error: result.error }, 400);
}
