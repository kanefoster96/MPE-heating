import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { StarPicker } from "@/components/StarPicker";
import { enquiriesOn } from "@/lib/enquiries";
import { getAppointmentByToken } from "@/lib/appointments";
import { getCustomer } from "@/lib/customers";
import { getJobReview } from "@/lib/job-completion";
import { reviewUrl } from "@/lib/settings";
import { KIND_LABEL, longDate } from "@/lib/day-plan";
import { business } from "@/lib/content";
import { submitReview } from "./actions";

export const metadata: Metadata = {
  title: "How did we do?",
  robots: { index: false, follow: false },
};

const CARD = "rounded-[28px] border border-line bg-white p-6 sm:p-8";

/**
 * "How did we do?" from the review ask: stars and a few words for MPE, then
 * the button to post a review on Google, offered to everyone whatever they
 * gave (asking only happy customers is review gating, which Google doesn't
 * allow). A low score also says we'll be in touch, and the team's told.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string; error?: string }>;
}) {
  const { token } = await params;
  const { thanks, error } = await searchParams;
  if (!enquiriesOn()) notFound();
  const visit = await getAppointmentByToken(token);
  if (!visit || !visit.customerId || visit.status !== "done") notFound();
  const [customer, review, google] = await Promise.all([getCustomer(visit.customerId), getJobReview(visit.id), reviewUrl()]);
  const first = customer?.name?.split(" ")[0];

  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6">
          <section className={CARD} data-review-page={review ? "done" : "ask"}>
            {review || thanks ? (
              <div className="text-center" data-review-thanks>
                <h1 className="text-3xl font-extrabold tracking-tight text-navy">Thank you{first ? `, ${first}` : ""}!</h1>
                {review && review.rating <= 3 ? (
                  <p className="mt-3 text-text-2">Sorry it wasn&rsquo;t better. We&rsquo;ve passed this straight to Fergal, and we&rsquo;ll be in touch to put it right.</p>
                ) : (
                  <p className="mt-3 text-text-2">That means a lot to a small local business.</p>
                )}
                {google && (
                  <div className="mt-6 rounded-2xl bg-cream p-5">
                    <p className="font-semibold text-navy">Would you share it on Google too?</p>
                    <p className="mt-1 text-sm text-text-2">It helps neighbours find a Gas Safe engineer they can trust. It only takes a minute.</p>
                    <a
                      href={`/visit/${token}/review/google`}
                      className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
                      data-google-review
                    >
                      Post a Google review
                    </a>
                  </div>
                )}
                <Link href={`/visit/${token}`} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-navy underline underline-offset-4">
                  Back to your visit
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-center text-3xl font-extrabold tracking-tight text-navy">How did we do?</h1>
                <p className="mt-2 text-center text-text-2">
                  Your {KIND_LABEL[visit.kind].toLowerCase()} on {longDate(visit.day)}
                </p>
                {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">Tap a star to rate the job.</p>}
                <form action={submitReview.bind(null, token)} className="mt-6 flex flex-col gap-5">
                  <StarPicker />
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-navy">
                      Anything you&rsquo;d like to tell us? <span className="font-normal text-text-2">(optional)</span>
                    </span>
                    <textarea name="comment" rows={3} maxLength={2000} className="w-full rounded-lg border border-line bg-white px-4 py-3 text-base outline-none focus:border-navy/40" />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-terracotta-deep px-6 text-base font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Send
                  </button>
                </form>
                <p className="mt-4 text-center text-xs text-text-2">Goes straight to {business.name}.</p>
              </>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
