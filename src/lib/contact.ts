/** How to reach MPE, for the messaging code ported from Kanvas Academy (its src/lib/contact.ts). */
import { CLUB } from "@/lib/club";

export const CONTACT_EMAIL = CLUB.email;
export const CONTACT_PHONE = CLUB.phone;
export const CONTACT_PHONE_E164 = CLUB.phoneE164;
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;
