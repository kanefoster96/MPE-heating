import { business, hero } from "@/lib/content";
import { PhoneIcon } from "./icons";

export function StickyMobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white/95 p-3 backdrop-blur sm:hidden">
      <a
        href={business.phoneHref}
        className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-terracotta py-3 text-sm font-semibold text-terracotta"
      >
        <PhoneIcon className="h-4 w-4" />
        Call
      </a>
      <a
        href="#book"
        className="flex flex-[1.4] items-center justify-center rounded-full bg-terracotta py-3 text-sm font-semibold text-white"
      >
        {hero.cta}
      </a>
    </div>
  );
}
