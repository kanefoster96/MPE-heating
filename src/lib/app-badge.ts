import { isCoach } from "@/lib/coach";
import { getNewEnquiryCount, getUnreadCountForCoach, getUnreadCountForUser } from "@/lib/chat-db";

/**
 * The number on the app icon (lib/push.ts sets it with each push): for the
 * team, unread conversations plus new booking enquiries; for a customer,
 * unread replies. A simpler take on Kanvas Academy's lib/app-badge.ts,
 * which also counts class and membership things MPE doesn't have.
 */
export async function badgeCountFor(userId: string): Promise<number> {
  try {
    if (await isCoach(userId)) {
      const [unread, enquiries] = await Promise.all([getUnreadCountForCoach(userId), getNewEnquiryCount()]);
      return unread + enquiries;
    }
    return await getUnreadCountForUser(userId);
  } catch {
    return 0;
  }
}
