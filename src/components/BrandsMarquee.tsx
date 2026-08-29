import { boilerBrands } from "@/lib/content";

const track = [...boilerBrands, ...boilerBrands];

const fadeMask = {
  maskImage:
    "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
  WebkitMaskImage:
    "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
};

export function BrandsMarquee() {
  return (
    <section className="border-b border-line bg-white py-8">
      <p className="mb-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-navy/40">
        Brands we install
      </p>
      <div className="group overflow-hidden" style={fadeMask}>
        {/* Trailing margin (not gap) on every item, including the last of
            each set — gap only inserts N-1 gaps for N items, which throws
            off the translateX(-50%) loop point and causes a visible snap.
            A margin per item keeps both duplicated sets exactly equal width,
            so the loop point lands perfectly on the seam. */}
        <div className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]">
          {track.map((brand, i) => (
            <span
              key={`${brand}-${i}`}
              className="mr-16 shrink-0 text-xl font-bold tracking-tight text-navy/30 sm:text-2xl"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
