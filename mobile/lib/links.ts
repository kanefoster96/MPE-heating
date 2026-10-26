import { SITE_URL } from "@/lib/site";

/**
 * Where a website address goes in the app: a link tapped in an email or
 * text (app/+native-intent.tsx), a push notification, or a notification
 * in the bell. Either a screen of the app, or a website page to open in the
 * in-app browser. The paths the site hands to the app are listed in
 * src/lib/app-links.ts on the site and mobile/app.config.js: keep the
 * three in step.
 */
export type LinkTarget = { route: string } | { web: string };

export function targetFor(href: string, opts: { staff?: boolean } = {}): LinkTarget {
  let path = href;
  try {
    const url = new URL(href, SITE_URL);
    path = url.pathname + url.search + url.hash;
  } catch {
    // Already a path.
  }
  const [pathname] = path.split(/[?#]/);
  // The "Confirm my email" button: signs the app in (app/app-sign-in.tsx), keeping its link.
  if (pathname === "/app-sign-in") return { route: path };
  if (pathname === "/messages") return { route: "/chat" };
  if (pathname === "/account" || pathname.startsWith("/account/")) return opts.staff ? { web: `${SITE_URL}${path}` } : { route: "/account" };
  const guide = pathname.match(/^\/help\/([a-z0-9-]+)$/);
  if (guide) return { route: `/guide/${guide[1]}` };
  const staffChat = pathname.match(/^\/staff\/messages\/([0-9a-f-]{36})$/);
  if (staffChat && opts.staff) return { route: `/chat/${staffChat[1]}` };
  return { web: `${SITE_URL}${path}` };
}
