import { hero } from "@/lib/content";

// The orange card on the right of the hero, in the kanvas.one style: the
// £50 call-out explained in four short rows, so the fee and the risk
// removal are clear before anyone books.
export function HeroCallOutCard() {
  const c = hero.callOut;
  return (
    <div className="w-full rounded-[22px] bg-[linear-gradient(135deg,var(--color-terracotta-deep)_0%,#a83c19_100%)] px-5 pt-5 pb-4 text-left text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
      <p className="text-[22px] font-extrabold tracking-[-0.02em]">{c.heading}</p>
      <ol className="mt-2">
        {c.rows.map((row, i) => (
          <li key={row.title} className={`flex gap-3 py-3 ${i ? "border-t border-white/25" : ""}`}>
            <span aria-hidden="true" className="grid h-7 w-7 flex-none place-items-center rounded-full bg-white/15 text-sm font-bold">
              {i + 1}
            </span>
            <span>
              <span className="block text-base font-bold leading-snug">{row.title}</span>
              <span className="block text-sm leading-snug text-[#ffe1d0]">{row.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 rounded-2xl bg-white/12 px-4 py-2.5 text-sm font-semibold">{c.foot}</p>
    </div>
  );
}
