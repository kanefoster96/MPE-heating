import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { FloatingWhatsapp } from "@/components/FloatingWhatsapp";
import { ProductArt } from "@/components/ProductArt";
import { QuestionIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex flex-col items-center bg-cream px-4 py-20 text-center sm:py-28">
        <ProductArt icon={<QuestionIcon className="h-full w-full" />} size="lg" />

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
          404
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          We couldn&rsquo;t find that page
        </h1>
        <p className="mt-4 max-w-md text-base text-navy/70">
          The page you&rsquo;re looking for might have moved, or the link might be out of date.
          Try one of these instead:
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="bg-btn-gradient inline-flex w-full items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold text-white sm:w-auto"
          >
            Back to homepage
          </Link>
          <Link
            href="/help"
            className="inline-flex w-full items-center justify-center rounded-full border-2 border-navy px-8 py-3.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:w-auto"
          >
            Browse boiler advice
          </Link>
        </div>

        <p className="mt-8 text-sm text-navy/50">
          Or{" "}
          <Link href="/contact" className="font-semibold text-terracotta hover:underline">
            get in touch
          </Link>{" "}
          and we&rsquo;ll point you in the right direction.
        </p>
      </main>
      <Footer />
      <FloatingWhatsapp />
    </>
  );
}
