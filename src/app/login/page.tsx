import type { Metadata } from "next";
import Image from "next/image";
import { LockIcon } from "@/components/coach/icons";
import { login } from "./actions";
import { CHAT_ON } from "@/lib/chat-on";
import { business } from "@/lib/content";

export const metadata: Metadata = {
  title: "Team login",
  robots: { index: false, follow: false },
};

// The team's login for the inbox (Kanvas Academy's login page, for MPE's
// admins and engineers). Customers sign in at /account with an emailed link.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string }>;
}) {
  const { error, next, email } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <Image src="/mpe-logo.png" alt={business.fullName} width={1189} height={513} priority className="mx-auto h-10 w-auto" />

      <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight">Team login</h1>
      <p className="mt-2 text-center text-sm text-muted">For MPE&rsquo;s admins and engineers, to answer customers and pick up new jobs.</p>

      {!CHAT_ON && (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          The inbox isn&rsquo;t switched on yet: it needs the Supabase project connecting first.
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <form action={login} className="mt-8 flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={email ?? ""}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={!CHAT_ON}
          className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-40"
        >
          <LockIcon /> Log in
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">Forgotten your password, or need an account? Ask an MPE admin.</p>
    </div>
  );
}
