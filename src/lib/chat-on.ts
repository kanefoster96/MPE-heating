/**
 * Whether live chat is switched on: true once the Supabase project's
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Until
 * then the site links to call, WhatsApp and email instead of the chat, and
 * /messages says chat is coming soon. Safe to read on the server or in the
 * browser (both are public variables, inlined at build).
 */
export const CHAT_ON = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
