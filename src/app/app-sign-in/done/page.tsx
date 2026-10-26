import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { OpenApp } from "./open-app";

export const metadata: Metadata = {
  title: "Email confirmed",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90";

/**
 * After "Confirm my email" (lib/app-sign-in.ts): this browser is signed in,
 * and the app is opened with a short one-use link that signs it in too.
 * On a phone that happens by itself; the button is there if it doesn't.
 * On a computer, the app button does nothing, so the account is offered.
 */
export default async function AppSignInDone({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const { h = "" } = await searchParams;
  const appUrl = `mpe://app-sign-in?h=${encodeURIComponent(h)}`;
  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className={CARD}>
            <Eyebrow>The MPE app</Eyebrow>
            <Heading as="h1" lead="Email confirmed" className="mt-3 text-[32px]" />
            <p className="mt-4 text-text-2">Thanks, you&rsquo;re signed in. Head back to the app and it&rsquo;ll sign you in there too.</p>
            {h && <OpenApp url={appUrl} />}
            <div className="mt-6 flex flex-col gap-3">
              {h && (
                <a href={appUrl} className={BUTTON}>
                  Back to the MPE app
                </a>
              )}
              <Link href="/account" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-white px-6 text-base font-semibold text-navy hover:border-navy/40">
                Or see your account here
              </Link>
            </div>
            <p className="mt-4 text-sm text-text-2">On a computer? Open the email on your phone to sign in to the app.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
