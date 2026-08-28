import type { ContentBlock } from "@/lib/blog";
import { AlertTriangleIcon } from "./icons";

export function BlogArticle({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} className="mt-2 text-xl font-extrabold text-navy sm:text-2xl">
                {block.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="text-base leading-relaxed text-navy/80">
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="flex flex-col gap-2.5">
                {block.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-base leading-relaxed text-navy/80">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl bg-terracotta-light px-5 py-4 text-sm leading-relaxed text-navy/80"
              >
                <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                {block.text}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
