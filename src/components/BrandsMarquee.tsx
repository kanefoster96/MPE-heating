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
        <div className="flex w-max animate-marquee items-center gap-16 group-hover:[animation-play-state:paused]">
          {track.map((brand, i) => (
            <span
              key={`${brand}-${i}`}
              className="shrink-0 text-xl font-bold tracking-tight text-navy/30 sm:text-2xl"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
