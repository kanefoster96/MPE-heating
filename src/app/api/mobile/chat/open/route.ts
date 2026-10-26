import { NextResponse } from "next/server";
import { mobileJson, mobileStaff, readJson } from "@/lib/mobile-api";
import { openChatByPhone, openCustomerChat } from "@/lib/app-chat";

/**
 * Opens a conversation to message someone first: by a mobile number (and
 * a name, if known), or for a customer (`customerId`). The one they have,
 * if they have one.
 */
export async function POST(request: Request) {
  const caller = await mobileStaff(request);
  if (caller instanceof NextResponse) return caller;
  const { phone, name, customerId } = await readJson<{ phone: string; name: string; customerId: string }>(request);
  const result =
    typeof customerId === "string" && /^[0-9a-f-]{36}$/i.test(customerId)
      ? await openCustomerChat(customerId)
      : await openChatByPhone(typeof phone === "string" ? phone : "", typeof name === "string" ? name.slice(0, 80) : null);
  return result.ok ? mobileJson({ id: result.id }) : mobileJson({ error: result.error }, 400);
}
