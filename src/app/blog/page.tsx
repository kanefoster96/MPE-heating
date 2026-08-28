import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PromoStrip } from "@/components/PromoStrip";
import { ServicePageHero } from "@/components/ServicePageHero";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { FormIcon, ArrowRightIcon } from "@/components/icons";
import { blogPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Boiler Advice & Guides",
  description:
    "Common boiler problems explained, why servicing matters, and how to tell when it's time for a new boiler — advice from MPE's Gas Safe engineers.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { url: `${SITE_URL}/blog` },
};

export default function BlogIndexPage() {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main>
        <ServicePageHero
          icon={<FormIcon className="h-full w-full" />}
          eyebrow="Advice & Guides"
          headline="Boiler advice from people who fix them"
          subline="Common problems explained, honest advice on servicing, and no-nonsense answers — from MPE's Gas Safe engineers across the North East."
          cta="Ask us a question"
          ticks={["Gas Safe registered", "Written by engineers", "No jargon"]}
        />

        <section className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {blogPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-[24px] bg-grey p-7 transition-colors hover:bg-grey/70"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
                    {post.category}
                  </p>
                  <h2 className="mt-3 text-xl font-bold text-navy">{post.title}</h2>
                  <p className="mt-2 flex-1 text-sm text-navy/70">{post.description}</p>
                  <div className="mt-5 flex items-center justify-between text-xs font-semibold text-navy/50">
                    <span>{post.readTime}</span>
                    <span className="inline-flex items-center gap-1.5 text-terracotta">
                      Read more
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <FinalCta />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
