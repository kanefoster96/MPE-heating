import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { CLUB } from "@/lib/club";
import { CheckIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "The MPE app",
  description: "Book a call-out, chat with us, follow your job and pay, all from your phone.",
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const STORE =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-navy px-6 text-base font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto";

// What the app does: each of these is in it (mobile/).
const FEATURES = [
  "Book a call-out, a service or a new boiler quote",
  "Chat with us, with photos of the boiler or its error code",
  "Follow your job, from booked to done",
  "Pay invoices with Apple Pay or a saved card",
  "Your certificates, receipts and maintenance plan in one place",
];

/**
 * "Get the app", from the row under every booking form: what the app
 * does, and the App Store and Google Play buttons once it's listed
 * (NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL). Until then it
 * says it's coming, and everything's on the website meanwhile.
 */
export default async function AppPage({ searchParams }: { searchParams: Promise<{ stay?: string }> }) {
  const { appStoreUrl, playStoreUrl } = CLUB.app;
  const listed = !!(appStoreUrl || playStoreUrl);
  // The link in our texts: a phone goes straight to its app store once the
  // app's listed (?stay=1 shows this page instead). A computer, or a phone
  // before then, gets this page, with live chat below.
  const { stay } = await searchParams;
  if (!stay) {
    const ua = (await headers()).get("user-agent") ?? "";
    if (appStoreUrl && /iPhone|iPad|iPod/i.test(ua)) redirect(appStoreUrl);
    if (playStoreUrl && /Android/i.test(ua)) redirect(playStoreUrl);
  }
  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>The MPE app</Eyebrow>
          <Heading as="h1" lead="MPE in your pocket." className="mt-3 text-[36px] sm:text-5xl" />
          <section className={`mt-8 ${CARD}`} aria-labelledby="what">
            <h2 id="what" className="text-xl font-semibold text-navy">
              What you can do in it
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-navy">
                  <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            {listed ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row" data-app-stores>
                {appStoreUrl && (
                  <a href={appStoreUrl} className={STORE}>
                    Download on the App Store
                  </a>
                )}
                {playStoreUrl && (
                  <a href={playStoreUrl} className={STORE}>
                    Get it on Google Play
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-6 rounded-2xl bg-cream px-4 py-3 text-text-2" data-app-coming>
                Coming soon to the App Store and Google Play. Until then, you can{" "}
                <Link href="/book" className="font-semibold text-terracotta-deep underline underline-offset-4">
                  book online
                </Link>{" "}
                and reach us any of the ways below.
              </p>
            )}
          </section>
          <ContactOptions className="mt-8" onAppPage />
        </div>
      </main>
      <Footer />
    </>
  );
}
