import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { peekSignInLink } from "@/lib/app-sign-in";
import { CHAT_ON } from "@/lib/chat-on";
import { confirmAppSignIn } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90";

/**
 * Where the app's "Confirm my email" button lands when it opens in a
 * browser rather than the app (lib/app-sign-in.ts). Confirming takes a tap,
 * never just loading the page, so a mail scanner or link preview can't use
 * the link up (Kanvas Academy's /confirm-email).
 */
export default async function AppSignInPage({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const { t = "", error } = await searchParams;
  const link = CHAT_ON ? await peekSignInLink("email", t) : ({ state: "invalid" } as const);

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className={CARD}>
            {link.state === "ok" ? (
              <>
                <Eyebrow>The MPE app</Eyebrow>
                <Heading as="h1" lead="Confirm your email" className="mt-3 text-[32px]" />
                <p className="mt-4 text-text-2">
                  Tap below to confirm <strong className="text-navy">{link.email}</strong> is yours and sign in. We&rsquo;ll take you back to the app.
                </p>
                {error && (
                  <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">That didn&rsquo;t work just now. Please try again.</p>
                )}
                <form action={confirmAppSignIn} className="mt-6">
                  <input type="hidden" name="t" value={t} />
                  <button type="submit" className={BUTTON}>
                    Confirm my email
                  </button>
                </form>
                <p className="mt-4 text-sm text-text-2">If you didn&rsquo;t ask to sign in to the MPE app, you can close this page.</p>
              </>
            ) : (
              <>
                <Eyebrow>The MPE app</Eyebrow>
                <Heading as="h1" lead={link.state === "used" ? "This link's been used" : "This link has run out"} className="mt-3 text-[32px]" />
                <p className="mt-4 text-text-2">
                  Each link works once, for an hour. Open the MPE app and ask for a new one, or get in touch and we&rsquo;ll help.
                </p>
                <div className="mt-6">
                  <ContactOptions />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
