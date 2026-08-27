import { business } from "@/lib/content";

export function AreasCovered() {
  return (
    <section className="bg-cream py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-grey px-6 py-4 text-center">
          <p className="text-sm text-navy/60">{business.areas}</p>
        </div>
      </div>
    </section>
  );
}
