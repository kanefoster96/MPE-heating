import { createAdminClient } from "@/lib/supabase/admin";

/**
 * MPE's products and prices (Settings). Fergal adds what he sells and sets
 * the price; they're one-tap lines on an invoice. Up to two are his repair
 * upsells: offered on the customer's pay page as a tick box at an offer
 * price (about 20% off, because he's already there), so a repair can come
 * with a quick, worthwhile extra job.
 */

export const MAX_UPSELLS = 2;

export type Product = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  upsell: boolean;
  upsellPricePence: number | null;
  sort: number;
};

type Row = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  upsell: boolean;
  upsell_price_pence: number | null;
  sort: number;
};

function mapRow(r: Row): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    pricePence: r.price_pence,
    upsell: r.upsell,
    upsellPricePence: r.upsell_price_pence,
    sort: r.sort,
  };
}

/** About 20% off, to the pound: the default offer price at a repair. */
export function defaultUpsellPrice(pricePence: number): number {
  return Math.max(100, Math.round((pricePence * 0.8) / 100) * 100);
}

/**
 * Quick jobs that sit well alongside a repair: little extra time on site,
 * worth doing while the boiler's open, and a good margin. Suggestions only:
 * Fergal adds the ones he does, at his own prices. The service is the one
 * the site already prices (from £79).
 */
export const SUGGESTED_PRODUCTS: { name: string; description: string; pricePence: number | null; why: string }[] = [
  { name: "Boiler service", description: "Annual service and safety check", pricePence: 7900, why: "The boiler's already open and he's already there." },
  { name: "Magnetic system filter", description: "Fitted on the return pipe", pricePence: null, why: "Under an hour, protects the boiler from sludge." },
  { name: "Carbon monoxide alarm", description: "Supplied and fitted", pricePence: null, why: "Minutes to fit, a real safety win." },
  { name: "System inhibitor top-up", description: "Chemical inhibitor added to the system", pricePence: null, why: "A few minutes, slows corrosion and sludge." },
  { name: "Thermostatic radiator valve", description: "Supplied and fitted, per valve", pricePence: null, why: "Quick swap, helps them save on heating." },
];

export async function listProducts(): Promise<Product[]> {
  const { data } = await createAdminClient()
    .from("products")
    .select("id, name, description, price_pence, upsell, upsell_price_pence, sort")
    .eq("archived", false)
    .order("sort")
    .order("created_at");
  return ((data ?? []) as Row[]).map(mapRow);
}

/** The products ticked as repair upsells, with the price to offer each at. */
export async function upsellProducts(): Promise<(Product & { offerPence: number })[]> {
  return (await listProducts())
    .filter((p) => p.upsell)
    .slice(0, MAX_UPSELLS)
    .map((p) => ({ ...p, offerPence: p.upsellPricePence ?? defaultUpsellPrice(p.pricePence) }));
}

function poundsToPence(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").replace(/[£,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

/** Reads the product form: name, description, price, and the offer price for a repair. */
export function productFromForm(
  formData: FormData,
): { ok: true; fields: { name: string; description: string | null; pricePence: number; upsellPricePence: number | null } } | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Give it a name." };
  const pricePence = poundsToPence(formData.get("price"));
  if (!pricePence) return { ok: false, error: `Set a price for ${name}.` };
  const upsellPricePence = poundsToPence(formData.get("upsellPrice"));
  if (upsellPricePence && upsellPricePence > pricePence) return { ok: false, error: "The repair offer price should be less than the usual price." };
  const description = String(formData.get("description") ?? "").trim().slice(0, 160) || null;
  return { ok: true, fields: { name, description, pricePence, upsellPricePence } };
}

export async function createProduct(fields: { name: string; description: string | null; pricePence: number; upsellPricePence: number | null }): Promise<boolean> {
  const { error } = await createAdminClient().from("products").insert({
    name: fields.name,
    description: fields.description,
    price_pence: fields.pricePence,
    upsell_price_pence: fields.upsellPricePence,
    sort: Date.now() % 1_000_000_000,
  });
  return !error;
}

export async function updateProduct(
  id: string,
  fields: { name: string; description: string | null; pricePence: number; upsellPricePence: number | null },
): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("products")
    .update({
      name: fields.name,
      description: fields.description,
      price_pence: fields.pricePence,
      upsell_price_pence: fields.upsellPricePence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return !error;
}

/** Ticks a product as a repair upsell, or unticks it. At most two at once. */
export async function setUpsell(id: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (on) {
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("upsell", true).eq("archived", false).neq("id", id);
    if ((count ?? 0) >= MAX_UPSELLS) return { ok: false, error: `You can offer up to ${MAX_UPSELLS} at a repair. Untick one first.` };
  }
  const { error } = await admin.from("products").update({ upsell: on, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: "Couldn't save that." } : { ok: true };
}

/** Removes a product from the list (kept for old invoices' sake, just hidden). */
export async function archiveProduct(id: string): Promise<boolean> {
  const { error } = await createAdminClient().from("products").update({ archived: true, upsell: false }).eq("id", id);
  return !error;
}
