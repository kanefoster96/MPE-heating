import { accreditations } from "@/lib/content";
import { GasSafeMarkIcon, ShieldIcon, AwardIcon } from "./icons";

const marks = [
  { label: accreditations[0], icon: GasSafeMarkIcon },
  { label: accreditations[1], icon: ShieldIcon },
  { label: accreditations[2], icon: AwardIcon },
];

export function AccreditationStrip() {
  return (
    <section className="bg-white py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 sm:px-6">
        {marks.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 text-navy/35 grayscale">
            <Icon className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
