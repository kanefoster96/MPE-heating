import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { Heading, Eyebrow } from "./Heading";
import type { TwoTone } from "@/lib/content";

// Shared shell for simple content pages (privacy, terms, about): header,
// a two-tone title, and a white card for the body.
export function ContentPageLayout({
  eyebrow,
  title,
  meta,
  children,
  afterContent,
}: {
  eyebrow: string;
  title: TwoTone;
  meta?: string;
  children: ReactNode;
  afterContent?: ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="bg-cream py-12 sm:py-16">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading as="h1" lead={title.lead} em={title.em} emLine className="mt-3 text-[36px] sm:text-5xl" />
          {meta && <p className="mt-3 text-sm text-text-3">{meta}</p>}

          <div className="mt-8 rounded-[28px] border border-line bg-white p-6 sm:p-10">{children}</div>
        </div>
      </main>
      {afterContent}
      <Footer />
    </>
  );
}
