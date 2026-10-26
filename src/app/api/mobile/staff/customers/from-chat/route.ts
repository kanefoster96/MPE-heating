import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { customerFromChat } from "@/lib/app-customer";

/** The customer a chat belongs to, made from the chat if they aren't one yet (lib/app-customer.ts). */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { conversationId } = await readJson<{ conversationId: string }>(request);
  if (typeof conversationId !== "string") return mobileJson({ error: "Which chat?" }, 400);
  const result = await customerFromChat(conversationId);
  if (!result.ok) return mobileJson({ error: result.error }, 400);
  // Just a number so far (a call or a text): the app asks for their details next.
  const { data } = await createAdminClient().from("customers").select("name, address").eq("id", result.id).maybeSingle();
  return mobileJson({ id: result.id, needsDetails: !data?.name || !data?.address });
}
