import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * The team opened someone's WhatsApp from the app (components/business-call.tsx):
 * a reply, as far as their bookings go, so new ones are marked contacted and
 * the same-day nudge stops. WhatsApp itself is free and nothing's sent from here.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const body = await readJson<{ conversationId?: string; to?: string }>(request);
  const admin = createAdminClient();
  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  if (!conversationId && typeof body.to === "string") {
    const phone = normalizePhone(body.to);
    if (phone) {
      const { data } = await admin.from("chat_conversations").select("id").eq("phone", phone).maybeSingle();
      conversationId = (data?.id as string | undefined) ?? null;
    }
  }
  if (conversationId) {
    await admin
      .from("enquiries")
      .update({ status: "contacted", updated_at: new Date().toISOString(), updated_by: caller.user.id })
      .eq("conversation_id", conversationId)
      .eq("status", "new");
  }
  return mobileJson({ ok: true });
}
