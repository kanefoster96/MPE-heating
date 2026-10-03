import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PromoBar } from "@/components/PromoBar";
import { RatingCard } from "@/components/Reviews";
import { ReviewCarousel } from "@/components/ReviewCarousel";
import { Stars } from "@/components/Stars";
import { ClosingCard } from "@/components/ClosingCard";
import { Footer } from "@/components/Footer";
import { MobileBar } from "@/components/MobileBar";
import { JsonLd } from "@/components/JsonLd";
import { business, rating, reviews } from "@/lib/content";
import { SITE_URL, breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Reviews",
  description: `${business.name} is 5-star rated on ${rating.source}. Read what customers in ${business.base} and across the North East say.`,
  alternates: { canonical: `${SITE_URL}/reviews` },
  openGraph: { url: `${SITE_URL}/reviews` },
};

// The 5-star rating and the parts of the job customers score, then every
// review, word for word from TrustATrader, as swipeable cards.
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
                Rated 5 stars by our <span className="highlight">customers.</span>
              </h1>
              <p className="mt-4 text-[17px] leading-normal text-text-2 lg:text-lg">
                Customers score us on {rating.source} for every part of the job.
              </p>
              <ul className="mt-6 divide-y divide-line border-y border-line">
                {rating.categories.map((label) => (
                  <li key={label} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-[15px] font-semibold">{label}</span>
                    <Stars size="h-[18px] w-[18px]" />
                  </li>
                ))}
              </ul>
            </div>
            <RatingCard external />
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="overflow-x-clip bg-cream py-12 lg:py-20">
            <h2 className="mx-auto max-w-6xl px-5 text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] sm:px-6 sm:text-4xl">
              What customers say
            </h2>
            <div className="mt-6">
              <ReviewCarousel reviews={reviews} source={rating.source} tone="white" />
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
