import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { CustomerFields } from "@/components/customer-fields";
import { CHAT_ON } from "@/lib/chat-on";
import { createClient } from "@/lib/supabase/server";
import { isCoach } from "@/lib/coach";
import { customerForUser } from "@/lib/customers";
import { appointmentsForCustomer } from "@/lib/appointments";
import { KIND_LABEL, longDate, windowLabel } from "@/lib/day-plan";
import { londonNow } from "@/lib/schedule-time";
import { sendSignInLink, signOut, updateMyDetails } from "./actions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";
const FIELD =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none focus:border-foreground/40";
const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">{children}</div>
      </main>
      <Footer />
    </>
  );
}

/**
 * The customer's account: their upcoming visits, and their details and
 * boiler, which they can keep up to date themselves (the team sees the same
 * record). Signing in is by an emailed link. Kanvas Academy's account page
 * is the starting point; MPE's customers have visits and a boiler instead
 * of memberships and dancers.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; saved?: string }>;
}) {
  const { sent, error, saved } = await searchParams;

  if (!CHAT_ON) {
    return (
      <Shell>
        <Eyebrow>Your account</Eyebrow>
        <Heading as="h1" lead="Your account." em="Coming soon." emLine className="mt-3 text-[36px] sm:text-5xl" />
        <div className={`mt-8 ${CARD}`}>
          <p className="text-text-2">Soon you&rsquo;ll be able to see your visits and keep your details up to date here. In the meantime, we&rsquo;re a call, a WhatsApp or an email away.</p>
          <ContactOptions className="mt-6" />
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed out, or only a chat guest so far: the sign-in form.
  if (!user || user.is_anonymous) {
    return (
      <Shell>
        <Eyebrow>Your account</Eyebrow>
        <Heading as="h1" lead="Your visits and details," em="in one place." emLine className="mt-3 text-[36px] sm:text-5xl" />
        <div className={`mt-8 ${CARD}`}>
          {sent ? (
            <div data-link-sent>
              <h2 className="text-xl font-semibold text-navy">Check your email</h2>
              <p className="mt-2 text-text-2">
                We&rsquo;ve sent a sign-in link to <strong className="text-navy">{sent}</strong>. Open it on this device to see your account.
              </p>
              <Link href="/account" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-terracotta-deep underline underline-offset-4">
                Use a different email
              </Link>
            </div>
          ) : (
            <form action={sendSignInLink} className="flex flex-col gap-4">
              <p className="text-text-2">Enter the email you booked with. We&rsquo;ll email you a link to sign in, no password needed.</p>
              {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-navy">Email</span>
                <input name="email" type="email" required autoComplete="email" inputMode="email" className={FIELD} />
              </label>
              <button type="submit" className={BUTTON}>
                Email me a sign-in link
              </button>
            </form>
          )}
        </div>
      </Shell>
    );
  }

  if (await isCoach(user.id)) redirect("/staff/schedule");

  const customer = await customerForUser(user.id, user.email);
  const today = londonNow().dateISO;
  const visits = customer ? await appointmentsForCustomer(customer.id) : [];
  const upcoming = visits.filter((v) => v.day >= today && v.status === "booked").reverse();

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Your account</Eyebrow>
          <Heading as="h1" lead={customer?.name ? `Hi ${customer.name.split(" ")[0]}.` : "Hi there."} className="mt-3 text-[36px] sm:text-5xl" />
          <p className="mt-2 text-sm text-text-2">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-medium text-text-2 underline underline-offset-4 hover:text-navy">
            Sign out
          </button>
        </form>
      </div>

      <section className={`mt-8 ${CARD}`} aria-labelledby="visits">
        <h2 id="visits" className="text-xl font-semibold text-navy">
          Your visits
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-text-2">Nothing booked at the moment.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3" data-my-visits>
            {upcoming.map((v) => (
              <li key={v.id} className="rounded-2xl border border-line bg-cream px-4 py-3">
                <p className="font-semibold text-navy">{KIND_LABEL[v.kind]}</p>
                <p className="text-text-2">
                  {longDate(v.day)}, between {windowLabel(v.start, v.end).replace("–", " and ")}
                </p>
                {(v.address || v.postcode) && <p className="text-sm text-text-2">{[v.address, v.postcode].filter(Boolean).join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/messages" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
            Message us
          </Link>
          <Link href="/emergency" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
            Book a call-out
          </Link>
          <Link href="/book/service" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40">
            Book a service
          </Link>
        </div>
      </section>

      <section id="details" className={`mt-6 scroll-mt-24 ${CARD}`} aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-xl font-semibold text-navy">
          Your details and boiler
        </h2>
        <p className="mt-1 text-text-2">Keep these up to date and our engineers arrive knowing what to expect.</p>
        {saved && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">Saved. Thanks!</p>}
        {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
        <form action={updateMyDetails} className="mt-6 flex flex-col gap-6">
          <CustomerFields customer={customer} withEmail={false} />
          <button type="submit" className={`${BUTTON} self-start`}>
            Save details
          </button>
        </form>
      </section>
    </Shell>
  );
}
