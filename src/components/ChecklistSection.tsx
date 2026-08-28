import { CheckIcon } from "./icons";

// Simple two-column tick list for topic-specific detail (common faults,
// what's included, etc.) on the service sub-pages.
export function ChecklistSection({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: string[];
}) {
  return (
    <section className="bg-cream py-14 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-terracotta">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            {title}
          </h2>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-navy/80 shadow-[0_10px_25px_-18px_rgba(31,42,58,0.3)]"
            >
              <CheckIcon className="h-5 w-5 shrink-0 text-terracotta" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
