import { targetFor } from "@/lib/links";

/**
 * A link that opened the app: a universal link from an email or text
 * ("Pay now", "View your quote", the chat), or mpe://. Screens the app has
 * open directly; any other page of the site opens in the in-app browser
 * over Home (app/open.tsx), so Apple Pay and the site's forms work as they
 * do on the web.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const target = targetFor(path.replace(/^mpe:\/\//, "/"));
    return "route" in target ? target.route : `/open?url=${encodeURIComponent(target.web)}`;
  } catch {
    return "/";
  }
}
