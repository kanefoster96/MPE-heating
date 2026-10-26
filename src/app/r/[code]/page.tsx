import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { RefCookie } from "@/components/RefCookie";
import { business } from "@/lib/content";
import { enquiriesOn } from "@/lib/enquiries";
import { REF_COOKIE_DAYS, referralRewards, referrerByCode } from "@/lib/referrals";

export const metadata: Metadata = {
  title: "Recommended to MPE",
  robots: { index: false, follow: false },
};

const CARD = "flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 transition-colors hover:border-navy/40";

/**
 * Where a customer's referral link lands: who recommended MPE, what the
 * newcomer gets, and the booking forms. The link's code is remembered so
 * the booking they send is linked to the customer who shared it. Referrals
 * off (no rewards set) or an unknown code: just the homepage.
 */
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!enquiriesOn()) redirect("/");
  const [rewards, referrer] = await Promise.all([referralRewards(), referrerByCode(code)]);
  if (!rewards || !referrer) redirect("/");
  const off = rewards.friendPence ? `£${Number.isInteger(rewards.friendPence / 100) ? rewards.friendPence / 100 : (rewards.friendPence / 100).toFixed(2)}` : null;

  return (
    <>
      <RefCookie code={code} days={REF_COOKIE_DAYS} />
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>Recommended to you</Eyebrow>
          <Heading
            as="h1"
            lead={`${referrer.firstName ?? "A customer"} recommends ${business.name}.`}
            em={off ? `${off} off your first job.` : "Gas Safe engineers you can trust."}
            emLine
            className="mt-3 text-[36px] sm:text-5xl"
          />
          <p className="mt-4 text-lg text-text-2">
            {off ? `Book through this page and ${off} comes off your first job with us. ` : ""}Gas Safe registered {business.gasSafeNumber}, based in {business.base}.
          </p>
          <ul className="mt-8 flex flex-col gap-3" data-referral-options>
            <li>
              <Link href="/emergency" className={CARD}>
                <span>
                  <span className="block font-semibold text-navy">Boiler broken down?</span>
                  <span className="block text-sm text-text-2">Book a call-out</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link href="/book/new-boiler" className={CARD}>
                <span>
                  <span className="block font-semibold text-navy">Thinking about a new boiler?</span>
                  <span className="block text-sm text-text-2">Get a free quote</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link href="/book/service" className={CARD}>
                <span>
                  <span className="block font-semibold text-navy">Service due?</span>
                  <span className="block text-sm text-text-2">Book a service</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>
          <p className="mt-8 text-center text-sm text-text-2">Rather talk to us?</p>
          <ContactOptions className="mt-2" />
        </div>
      </main>
      <Footer />
    </>
  );
}
