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

/** A section of the website's account page (/account#plan), as the app's own screen. */
function accountRoute(section: string): string {
  const screens: Record<string, string> = {
    visits: "/jobs",
    past: "/jobs",
    payments: "/my-payments",
    quotes: "/my-payments",
    files: "/my-files",
    plan: "/my-plan",
    cards: "/my-cards",
    details: "/my-details",
    request: "/request-visit",
  };
  return screens[section] ?? "/account";
}

const ID = "([0-9a-f-]{36})";

/**
 * The website's team pages, as the app's own screens: a link in a push,
 * an email or a text to the team opens the app, never the website. Each
 * screen sends anyone who isn't on the team back to Home.
 */
function teamRoute(pathname: string, search: URLSearchParams): string | null {
  const customer = search.get("customer");
  const withCustomer = (route: string) => (customer && /^[0-9a-f-]{36}$/.test(customer) ? `${route}?customer=${customer}` : route);
  const day = search.get("date");
  const exact: Record<string, string> = {
    "/staff": "/",
    "/staff/messages": "/chat",
    "/staff/jobs": "/jobs",
    "/staff/customers": "/customers",
    "/staff/customers/new": "/customer-form",
    "/staff/schedule": day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `/calendar?day=${day}` : "/calendar",
    "/staff/payments/new": withCustomer("/new-payment"),
    "/staff/invoices": "/invoices",
    "/staff/quotes": "/quotes",
    "/staff/quotes/new": withCustomer("/new-quote"),
    "/staff/plan": "/plan",
    "/staff/days-off": "/days-off",
    "/staff/settings": "/settings",
  };
  const bare = pathname.replace(/\/+$/, "") || "/";
  // One invoice ("Still unpaid"), and the requests waiting on the team (the bell).
  const invoice = search.get("invoice");
  if (bare === "/staff/invoices" && invoice && /^[0-9a-f-]{36}$/.test(invoice)) return `/invoice/${invoice}`;
  if (bare === "/staff/schedule" && search.get("waiting") === "1") return "/notifications";
  if (exact[bare]) return exact[bare];
  const patterns: [RegExp, (id: string) => string][] = [
    [new RegExp(`^/staff/messages/${ID}$`), (id) => `/chat/${id}`],
    [new RegExp(`^/staff/customers/${ID}$`), (id) => `/customer/${id}`],
    [new RegExp(`^/staff/jobs/${ID}/finish$`), (id) => `/finish/${id}`],
    [new RegExp(`^/staff/jobs/${ID}$`), (id) => `/job/${id}`],
    [new RegExp(`^/staff/quotes/${ID}$`), (id) => `/quote/${id}`],
  ];
  for (const [pattern, route] of patterns) {
    const match = bare.match(pattern);
    if (match) return route(match[1]);
  }
  return null;
}

export function targetFor(href: string, opts: { staff?: boolean } = {}): LinkTarget {
  let path = href;
  let search = new URLSearchParams();
  try {
    const url = new URL(href, SITE_URL);
    path = url.pathname + url.search + url.hash;
    search = url.searchParams;
  } catch {
    // Already a path.
  }
  const [pathname] = path.split(/[?#]/);
  // The "Confirm my email" button: signs the app in (app/app-sign-in.tsx), keeping its link.
  if (pathname === "/app-sign-in") return { route: path };
  if (pathname === "/messages") return { route: "/chat" };
  if (pathname === "/account" || pathname.startsWith("/account/")) return opts.staff ? { route: "/menu" } : { route: accountRoute(path.split("#")[1] ?? "") };
  const guide = pathname.match(/^\/help\/([a-z0-9-]+)$/);
  if (guide) return { route: `/guide/${guide[1]}` };
  if (pathname === "/staff" || pathname.startsWith("/staff/")) {
    const team = teamRoute(pathname, search);
    if (team) return { route: team };
  }
  return { web: `${SITE_URL}${path}` };
}
