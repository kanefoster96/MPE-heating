import { alt, size, contentType, generateOgImage } from "@/lib/ogImage";

// Node runtime (not edge) — needed to read the logo file off disk.
export const runtime = "nodejs";

export { alt, size, contentType };

export default function Image() {
  return generateOgImage();
}
