import { getCoachRoster } from "@/lib/coach";
import { teamHours } from "@/lib/team-hours";
import { pushCoachesNewMessage } from "@/lib/push";

/**
 * Who a customer's message notifies. Ported from Kanvas Academy, where
 * coaches only hear about families in their classes; MPE's team is small
 * and every job could be anyone's, so every admin and engineer is buzzed
 * for every message. Everyone can open every conversation in the inbox.
 */

/** Every admin and engineer on the roster. */
export async function chatRecipientIds(): Promise<string[]> {
  const roster = await getCoachRoster();
  return roster.map((r) => r.id);
}

/** A customer (or website visitor) wrote in: push the team. */
export async function notifyStaffOfFamilyMessage(params: { conversationId: string; fromName: string; body: string }): Promise<void> {
  // 8pm to 8am it waits, unread, for the 8am summary (lib/follow-up-sweep.ts): nobody's woken by it.
  if (!teamHours()) return;
  try {
    await pushCoachesNewMessage({ ...params, recipientIds: await chatRecipientIds() });
  } catch (err) {
    console.error("notifyStaffOfFamilyMessage failed", err);
  }
}
