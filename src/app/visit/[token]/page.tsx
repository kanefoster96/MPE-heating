import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { ContactOptions } from "@/components/ContactOptions";
import { DayPartFields } from "@/components/DayPartPicker";
import { CalendarIcon, MapPinIcon } from "@/components/icons";
import { enquiriesOn } from "@/lib/enquiries";
import { getAppointmentByToken } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { KIND_LABEL, longDate } from "@/lib/day-plan";
import { requestedWhen, whenLine } from "@/lib/visit-copy";
import { londonNow } from "@/lib/schedule-time";
import { arrivalClock } from "@/lib/visit-notify";
import { fileLabel, sharedFilesForVisit } from "@/lib/job-files";
import { askForAnotherTime } from "./actions";
import { getJobReview } from "@/lib/job-completion";
import { formatPence, invoiceNumber, paymentsForAppointments } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Your visit",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";

/**
 * A customer's page for one visit, from the link in every message about it:
 * what's booked and when, add it to their calendar, or ask for another time.
 * No sign-in: the link itself is private to them.
 */
export default async function VisitPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ asked?: string; error?: string }>;
}) {
  const { token } = await params;
  const { asked, error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const visit = await getAppointmentByToken(token);
  if (!visit || !visit.customerId) notFound();
  const customer = await getCustomer(visit.customerId);
  const today = londonNow().dateISO;
  const upcoming = visit.day >= today;
  const where = [
    visit.address ?? customer?.address,
    visit.postcode ?? customer?.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  const first = customer?.name?.split(" ")[0];
  const review = visit.status === "done" ? await getJobReview(visit.id) : null;
  const files = visit.status === "done" ? await sharedFilesForVisit(visit.id).catch(() => []) : [];
  const payments = ((await paymentsForAppointments([visit.id])).get(visit.id) ?? []).filter((x) => x.status !== "cancelled");

  const heading =
    visit.status === "requested"
      ? { lead: "Request received.", em: "We'll confirm the time." }
      : visit.status === "no_access"
        ? { lead: "Sorry we missed you.", em: "Pick another time." }
      : visit.status === "cancelled"
        ? { lead: "This visit is", em: "cancelled." }
        : visit.status === "done" || !upcoming
          ? { lead: "Thanks for", em: "choosing MPE." }
          : {
              lead: first ? `You're booked in, ${first}.` : "You're booked in.",
              em: "See you then.",
            };

  // A missed visit's day has gone, but they can still pick another.
  const canAsk =
    (upcoming && (visit.status === "booked" || visit.status === "requested")) ||
    visit.status === "no_access";

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>Your visit</Eyebrow>
          <Heading
            as="h1"
            lead={heading.lead}
            em={heading.em}
            emLine
            className="mt-3 text-[36px] sm:text-5xl"
          />

          {visit.status === "booked" && visit.day === today && visit.onMyWayAt && (
            <p className="mt-8 rounded-2xl border border-success/30 bg-success/10 px-5 py-4 text-lg font-semibold text-success" role="status" data-on-my-way>
              We&rsquo;re on the way
              {visit.onMyWayEta ? `: with you around ${arrivalClock(visit.onMyWayAt, visit.onMyWayEta)}` : ""}.
            </p>
          )}

          <section
            className={`mt-6 ${CARD}`}
            aria-label="Visit details"
            data-visit-status={visit.status}
          >
            <dl className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <dt className="text-sm text-text-2">Visit</dt>
              <dd className="font-semibold text-navy">
                {KIND_LABEL[visit.kind]}
              </dd>
              <dt className="text-sm text-text-2">
                {visit.status === "requested" ? "You asked for" : "When"}
              </dt>
              <dd className="font-semibold text-navy" data-visit-when>
                {visit.status === "requested"
                  ? `${requestedWhen(visit.day, visit.part)}${visit.part === "any" || !visit.part ? ", any time" : ""}`
                  : visit.status === "cancelled"
                    ? longDate(visit.day)
                    : whenLine(visit)}
              </dd>
              {where && (
                <>
                  <dt className="text-sm text-text-2">Where</dt>
                  <dd className="flex items-start gap-1.5 font-semibold text-navy">
                    <MapPinIcon
                      className="mt-0.5 h-4 w-4 shrink-0 text-text-2"
                      aria-hidden="true"
                    />
                    {where}
                  </dd>
                </>
              )}
            </dl>
            {visit.status === "done" && visit.jobReport && (
              <div className="mt-6 rounded-2xl bg-cream px-4 py-3" data-visit-report>
                <p className="text-sm font-semibold text-navy">What we did</p>
                <p className="mt-1 whitespace-pre-wrap text-text-2">{visit.jobReport}</p>
              </div>
            )}
            {files.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" data-visit-files>
                {files.map((f) => (
                  <li key={f.id}>
                    <a
                      href={f.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-navy hover:border-navy/40"
                    >
                      {f.kind === "photo" ? "Photo" : fileLabel(f)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {visit.status === "done" && !review && (
              <Link
                href={`/visit/${token}/review`}
                className="mt-5 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40"
                data-rate-visit
              >
                ★ Rate your visit
              </Link>
            )}
            {visit.status === "requested" && (
              <p className="mt-5 rounded-2xl bg-cream px-4 py-3 text-text-2">
                We&rsquo;ll be in touch to confirm the time. You&rsquo;ll get
                the details by message once it&rsquo;s booked.
              </p>
            )}
            {visit.status === "booked" && upcoming && (
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href={`/visit/${token}/calendar.ics`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy/40"
                >
                  <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                  Add to calendar
                </a>
              </div>
            )}
          </section>

          {canAsk && (
            <section
              id="another-time"
              className={`mt-6 scroll-mt-24 ${CARD}`}
              aria-labelledby="another-heading"
            >
              {asked || visit.change ? (
                <div data-asked>
                  <h2
                    id="another-heading"
                    className="text-xl font-semibold text-navy"
                  >
                    {visit.status === "requested"
                      ? "Request updated"
                      : "Thanks, we've got that"}
                  </h2>
                  <p className="mt-2 text-text-2">
                    {visit.change
                      ? `You asked for ${requestedWhen(visit.change.day, visit.change.part)}${visit.change.part === "any" ? ", any time" : ""}. We'll be in touch to confirm${visit.status === "booked" ? ", and your visit stays as it is until then" : ""}.`
                      : "We'll be in touch to confirm the time."}
                  </p>
                </div>
              ) : (
                <>
                  <h2
                    id="another-heading"
                    className="text-xl font-semibold text-navy"
                  >
                    {visit.status === "requested"
                      ? "Need a different time?"
                      : visit.status === "no_access"
                        ? "When suits you instead?"
                        : "Can't make it?"}
                  </h2>
                  <p className="mt-1 text-text-2">
                    Pick a time that suits you better and we&rsquo;ll get back
                    to you.
                  </p>
                  {error && (
                    <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
                      {error}
                    </p>
                  )}
                  <form
                    action={askForAnotherTime.bind(null, token)}
                    className="mt-5 flex flex-col gap-5"
                  >
                    <DayPartFields
                      fromToday={
                        visit.kind === "callout" || visit.kind === "repair"
                      }
                      submitLabel="Ask for this time"
                    >
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-navy">
                          Anything we should know?{" "}
                          <span className="font-normal text-text-2">
                            (optional)
                          </span>
                        </span>
                        <textarea
                          name="note"
                          rows={2}
                          maxLength={500}
                          className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base outline-none focus:border-navy/40"
                        />
                      </label>
                    </DayPartFields>
                  </form>
                </>
              )}
            </section>
          )}

          {payments.length > 0 && (
            <section className={`mt-6 ${CARD}`} aria-label="Payments" data-visit-payments>
              <ul className="flex flex-col gap-2">
                {payments.map((pay) => (
                  <li key={pay.id}>
                    <Link
                      href={`/pay/${pay.publicToken}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-cream px-4 py-3 hover:border-navy/40"
                    >
                      <span className="font-semibold text-navy">
                        {pay.kind === "callout_fee" ? "Call-out fee" : `Invoice ${invoiceNumber(pay.number)}`}
                      </span>
                      <span className="text-right">
                        <span className="block font-bold text-navy">{formatPence(pay.amountPence)}</span>
                        <span className={`block text-xs font-semibold ${pay.status === "paid" ? "text-success" : "text-terracotta-deep"}`}>
                          {pay.status === "paid" ? "Paid" : "Pay now"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ContactOptions className="mt-8" />
          {customer?.userId && (
            <p className="mt-6 text-center">
              <Link
                href="/account"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-terracotta-deep underline underline-offset-4"
              >
                See all your visits
              </Link>
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
