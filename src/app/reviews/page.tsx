import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { RatingCard, ReviewCard } from "@/components/Reviews";
import { ClosingCard } from "@/components/ClosingCard";
import { Footer } from "@/components/Footer";
import { MobileBar } from "@/components/MobileBar";
import { JsonLd } from "@/components/JsonLd";
import { business, rating, reviews } from "@/lib/content";
import { SITE_URL, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Reviews",
  description: `${business.name} is rated ${rating.score} out of 5 from ${rating.count} reviews on ${rating.source}. Read what customers in ${business.base} and across the North East say.`,
  alternates: { canonical: `${SITE_URL}/reviews` },
  openGraph: { url: `${SITE_URL}/reviews` },
};

// Every review, word for word from TrustATrader, under the rating and the
// score for each part of the job.
export default function ReviewsPage() {
  return (
    <>
      <Nav />
      <PromoBar />
      <main>
        <section className="overflow-x-clip bg-page pt-8 pb-12 lg:pt-16 lg:pb-20">
          <div className="mx-auto grid max-w-2xl gap-10 px-5 sm:px-6 lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ticket-stub">Reviews</p>
              <h1 className="mt-2 text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
                Rated {rating.score} out of 5 by our <span className="highlight">customers.</span>
              </h1>
              <p className="mt-4 text-[17px] leading-normal text-text-2 lg:text-lg">
                From {rating.count} reviews on {rating.source}, scored on every part of the job.
              </p>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {rating.categories.map((c) => (
                  <div key={c.label} className="flex items-center gap-4 py-3">
                    <dt className="w-40 flex-none text-[15px] font-semibold">{c.label}</dt>
                    <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-grey">
                      <span
                        className="block h-full rounded-full bg-terracotta-deep"
                        style={{ width: `${(Number(c.score) / 5) * 100}%` }}
                      />
                    </span>
                    <dd className="w-10 text-right text-[15px] font-bold tabular-nums">{c.score}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <RatingCard external />
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="bg-cream py-12 lg:py-20">
            <div className="mx-auto max-w-6xl px-5 sm:px-6">
              <h2 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                What customers say
              </h2>
              <ul className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3 lg:gap-6">
                {reviews.map((r) => (
                  <li key={r.name + r.date} className="mb-4 break-inside-avoid lg:mb-6 [&_figure]:bg-white">
                    <ReviewCard review={r} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="pt-12 lg:pt-20">
          <ClosingCard />
        </div>
      </main>
      <Footer />
      <MobileBar />
      <JsonLd data={breadcrumbJsonLd([{ name: "Reviews", path: "/reviews" }])} />
    </>
  );
}
