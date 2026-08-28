import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { PromoStrip } from "./PromoStrip";
import { Footer } from "./Footer";
import { FloatingWhatsapp } from "./FloatingWhatsapp";

// Shared shell for simple content pages (privacy, terms, about) — same
// header + white card treatment as a blog post, minus the blog-specific
// bits (category, read time, related-service CTA).
export function ContentPageLayout({
  eyebrow,
  title,
  meta,
  children,
  afterContent,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
  children: ReactNode;
  // Rendered full-width between the content card and the footer — e.g. a
  // FinalCta on the About page. Omitted entirely on utility pages like
  // privacy/terms.
  afterContent?: ReactNode;
}) {
  return (
    <>
      <Nav />
      <PromoStrip />
      <main className="bg-cream py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy sm:text-4xl">
            {title}
          </h1>
          {meta && <p className="mt-3 text-sm text-navy/50">{meta}</p>}

          <div className="mt-8 rounded-[28px] bg-white p-6 shadow-[0_20px_45px_-25px_rgba(31,42,58,0.3)] sm:p-10">
            {children}
          </div>
        </div>
      </main>
      {afterContent}
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
