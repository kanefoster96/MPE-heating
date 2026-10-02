import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Heading, Eyebrow } from "@/components/Heading";
import { IconTile } from "@/components/Chip";
import { QuestionIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex flex-col items-center bg-page px-4 py-20 text-center sm:py-28">
        <IconTile icon={<QuestionIcon />} primary className="-rotate-3" />
        <Eyebrow className="mt-8">404</Eyebrow>
        <Heading
          as="h1"
          lead="We couldn't find that page."
          em="Try one of these."
          emLine
          className="mt-3 text-[36px] sm:text-5xl"
        />
        <p className="mt-4 max-w-md text-base leading-relaxed text-text-2">
          The page might have moved, or the link might be out of date.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="bg-btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 text-base font-semibold text-white sm:w-auto"
          >
            Back to homepage
          </Link>
          <Link
            href="/help"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-navy/20 px-8 text-base font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:w-auto"
          >
            Browse boiler advice
          </Link>
        </div>

        <p className="mt-8 text-sm text-text-2">
          Or{" "}
          <Link href="/contact" className="font-semibold text-navy underline decoration-navy/30 underline-offset-4">
            get in touch
          </Link>{" "}
          and we&rsquo;ll point you in the right direction.
        </p>
      </main>
      <Footer />
    </>
  );
}
