import { alt, size, contentType, generateOgImage } from "@/lib/ogImage";

export const runtime = "nodejs";

export { alt, size, contentType };

export default function Image() {
  return generateOgImage();
}
