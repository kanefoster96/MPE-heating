import { reviews } from "@/lib/content";
import { StarIcon } from "./icons";
import { Eyebrow } from "./Heading";
import { Reveal } from "./Reveal";

function Stars({ className = "" }: { className?: string }) {
  return (
    <span className={`flex gap-0.5 text-navy ${className}`} aria-label="Five stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} className="h-4 w-4" />
      ))}
    </span>
  );
}

// One review set large as the headline of the section, with three shorter
// ones beside it separated by rules. Static, no carousel, no boxes.
export function Reviews() {
  const [lead, ...rest] = reviews;
  return (
    <section className="bg-page py-14 lg:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16">
        <Reveal as="figure" className="lg:col-span-7">
          <Eyebrow>What customers say</Eyebrow>
          <Stars className="mt-6" />
          <blockquote className="mt-5 text-2xl font-bold leading-snug tracking-tight text-navy sm:text-3xl lg:text-4xl">
            &ldquo;{lead.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-6 text-sm text-text-2">
            <span className="font-semibold text-navy">{lead.name}</span> · {lead.date}
          </figcaption>
        </Reveal>

        <Reveal as="ul" className="divide-y divide-line border-t border-line lg:col-span-5 lg:border-t-0">
          {rest.map((r) => (
            <li key={r.name} className="py-6 first:pt-6 lg:first:pt-0">
              <Stars />
              <p className="mt-3 text-base leading-relaxed text-navy">&ldquo;{r.quote}&rdquo;</p>
              <p className="mt-3 text-xs text-text-3">
                <span className="font-semibold text-navy">{r.name}</span> · {r.date}
              </p>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
