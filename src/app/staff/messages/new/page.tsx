import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { CHAT_ON } from "@/lib/chat-on";
import { openChatByPhone } from "../actions";

/**
 * Text a customer first: enter their mobile (and a name, if known) and land
 * in their conversation, where the composer's Text option sends the first
 * message by SMS. Opens the existing thread if that number already has one.
 */
export default async function NewStaffChatPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!CHAT_ON) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/staff/messages/new");
  if (!(await isCoach(user.id))) redirect("/");

  const field =
    "mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus:border-foreground/40";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/staff/messages"
        className="text-sm text-muted transition-colors hover:text-foreground active:underline active:text-foreground"
      >
        ← Back to Inbox
      </Link>

      <p className="mt-6 text-sm uppercase tracking-widest text-muted">MPE team</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Text a customer</h1>
      <p className="mt-2 text-muted">
        Enter their mobile. You&rsquo;ll land in their chat, where anything you send goes to them by text.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>
      )}

      <form action={openChatByPhone} className="mt-6 flex flex-col gap-4">
        <label className="text-sm font-medium">
          Mobile number
          <input name="phone" type="tel" inputMode="tel" autoComplete="off" required placeholder="07…" className={field} />
        </label>
        <label className="text-sm font-medium">
          Name <span className="font-normal text-muted">(optional)</span>
          <input name="name" type="text" autoComplete="off" className={field} />
        </label>
        <button
          type="submit"
          className="min-h-11 self-start rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Open chat
        </button>
      </form>
    </div>
  );
}
