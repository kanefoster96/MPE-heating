import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { CHAT_ON } from "@/lib/chat-on";
import { deleteMyAccount } from "./actions";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to delete your MPE account, on the website or in the MPE app, and what's deleted.",
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const DANGER =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-danger px-6 text-base font-semibold text-white transition-opacity hover:opacity-90";

/**
 * Deleting an account (Google Play asks every app for a web page like
 * this). Signed in, there's the button; signed out, how to do it here, in
 * the app, or by asking us. Both use lib/account-delete.ts, so what's
 * deleted and what's kept is the same everywhere.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const { error, deleted } = await searchParams;
  let signedIn: { email: string | null } | null = null;
  let staff = false;
  if (CHAT_ON) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !user.is_anonymous) {
      signedIn = { email: user.email ?? null };
      staff = await isCoach(user.id);
    }
  }

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>Your account</Eyebrow>
          <Heading as="h1" lead="Delete your account" className="mt-3 text-[36px] sm:text-5xl" />

          {deleted ? (
            <div className={`mt-8 ${CARD}`} data-account-deleted>
              <h2 className="text-xl font-semibold text-navy">Your account has been deleted</h2>
              <p className="mt-2 text-text-2">Your login and your chat with us are gone. Thanks for using MPE.</p>
            </div>
          ) : (
            <>
              <section className={`mt-8 ${CARD}`} aria-labelledby="what">
                <h2 id="what" className="text-xl font-semibold text-navy">
                  What&rsquo;s deleted, and what&rsquo;s kept
                </h2>
                <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-text-2">
                  <li>Deleted: your login, your chat with us (messages and photos), and the app&rsquo;s notifications to your phone.</li>
                  <li>
                    Kept: the invoices and job records for work we&rsquo;ve done for you, as the business has to keep its accounts. To ask for anything else
                    to be removed, get in touch.
                  </li>
                  <li>On the maintenance plan? Cancel it in your account first, then delete your account.</li>
                </ul>
              </section>

              <section className={`mt-6 ${CARD}`} aria-labelledby="how">
                {signedIn && !staff ? (
                  <>
                    <h2 id="how" className="text-xl font-semibold text-navy">
                      Delete {signedIn.email ?? "your account"}
                    </h2>
                    {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
                    <form action={deleteMyAccount} className="mt-4 flex flex-col gap-4">
                      <label className="flex min-h-11 items-start gap-3 text-text-2">
                        <input type="checkbox" name="confirm" value="yes" required className="mt-1 h-5 w-5 accent-[#c81e1e]" />
                        <span>I understand this can&rsquo;t be undone.</span>
                      </label>
                      <button type="submit" className={DANGER}>
                        Delete my account
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 id="how" className="text-xl font-semibold text-navy">
                      How to delete it
                    </h2>
                    <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-text-2">
                      <li>
                        In the MPE app: tap your picture (top left), then <strong className="text-navy">Delete account</strong>.
                      </li>
                      <li>
                        On this website:{" "}
                        <Link href="/account" className="font-semibold text-terracotta-deep underline underline-offset-4">
                          sign in to your account
                        </Link>
                        , then come back to this page.
                      </li>
                      <li>Or ask us, and we&rsquo;ll do it for you.</li>
                    </ol>
                    {staff && <p className="mt-4 text-sm text-text-2">Team logins are removed by an admin.</p>}
                    <ContactOptions className="mt-6" />
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
