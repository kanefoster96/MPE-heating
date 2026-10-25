import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { DayPartFields } from "@/components/DayPartPicker";
import { CATEGORY_LABEL, enquiriesOn, getEnquiryByToken, issueLine } from "@/lib/enquiries";
import { createAdminClient } from "@/lib/supabase/admin";
import { KIND_LABEL } from "@/lib/day-plan";
import { requestedWhen, whenLine } from "@/lib/visit-copy";
import { pickTimeForEnquiry } from "./actions";

export const metadata: Metadata = {
  title: "Pick a time",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";

/**
 * Where a follow-up about a booking form lands: what they asked us about,
 * in their own words, and a day and time to pick. If it's already booked or
 * asked for, it says so and links to the visit instead.
 */
export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const enquiry = await getEnquiryByToken(token);
  if (!enquiry?.customerId) notFound();

  // A visit already asked for or booked from this form.
  const { data: existing } = await createAdminClient()
    .from("appointments")
    .select("kind, day, start_minute, end_minute, part, status, public_token")
    .eq("enquiry_id", enquiry.id)
    .in("status", ["requested", "booked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const issue = issueLine(enquiry, 200);

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>{CATEGORY_LABEL[enquiry.category]}</Eyebrow>
          <Heading as="h1" lead={existing ? "You're all set." : "Pick a time"} em={existing ? "" : "that suits you."} emLine className="mt-3 text-[36px] sm:text-5xl" />

          <section className={`mt-8 ${CARD}`} aria-label="What you asked about">
            <p className="text-sm text-text-2">You asked us about</p>
            <p className="mt-1 text-lg font-semibold text-navy">{issue ?? CATEGORY_LABEL[enquiry.category]}</p>
            {enquiry.postcode && <p className="mt-1 text-text-2">{enquiry.postcode}</p>}
          </section>

          {existing ? (
            <section className={`mt-6 ${CARD}`} data-request-existing>
              <p className="font-semibold text-navy">{KIND_LABEL[existing.kind as keyof typeof KIND_LABEL]}</p>
              <p className="mt-1 text-text-2">
                {existing.status === "requested"
                  ? `You asked for ${requestedWhen(existing.day as string, existing.part as "am" | "pm" | "any" | null)}. We'll be in touch to confirm the time.`
                  : `Booked for ${whenLine({ kind: existing.kind as "service", day: existing.day as string, start: existing.start_minute as number, end: existing.end_minute as number })}.`}
              </p>
              <Link
                href={`/visit/${existing.public_token}`}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-terracotta-deep underline underline-offset-4"
              >
                See your visit
              </Link>
            </section>
          ) : (
            <section className={`mt-6 ${CARD}`} aria-label="Pick a time">
              {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</p>}
              <form action={pickTimeForEnquiry.bind(null, token)} className="flex flex-col gap-5" data-pick-time>
                <DayPartFields fromToday={enquiry.category === "callout"} submitLabel="Send">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-navy">
                      Anything else we should know? <span className="font-normal text-text-2">(optional)</span>
                    </span>
                    <textarea name="note" rows={2} maxLength={500} className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base outline-none focus:border-navy/40" />
                  </label>
                </DayPartFields>
              </form>
              <p className="mt-4 text-sm text-text-2">We&rsquo;ll confirm the time with you, or suggest the nearest one we have.</p>
            </section>
          )}

          <ContactOptions className="mt-8" />
        </div>
      </main>
      <Footer />
    </>
  );
}
