import { StarIcon } from "./icons";
import { Reveal } from "./Reveal";

// Five orange stars that pop in one after another the first time they
// scroll into view. Decorative: the text beside them says "5-star".
export function Stars({ size = "h-5 w-5", className = "" }: { size?: string; className?: string }) {
  return (
    <Reveal as="span" base="star-pop" className={`flex gap-0.5 text-terracotta ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} className={size} aria-hidden="true" />
      ))}
    </Reveal>
  );
}
