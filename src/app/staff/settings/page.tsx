import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { isAdmin } from "@/lib/coach";
import { MAX_UPSELLS, SUGGESTED_PRODUCTS, defaultUpsellPrice, listProducts, type Product } from "@/lib/products";
import { formatPence } from "@/lib/payments";
import { addProduct, removeProduct, saveProduct, savePlanPrices, saveReviewLink, toggleUpsell } from "./actions";
import { PLAN_BENEFITS, planPrices } from "@/lib/maintenance-plan";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm";
const pounds = (pence: number | null | undefined) => (pence ? (pence / 100).toString() : "");

/**
 * Admin settings: MPE's products and prices. Each is a one-tap line when
 * taking payment; up to two are offered at repairs as tick boxes on the
 * customer's pay page, at an offer price (about 20% off: he's already there).
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string; suggest?: string; name?: string; reviewDone?: string; reviewError?: string; planDone?: string; planError?: string }>;
}) {
  const params = await searchParams;
  const user = await requireStaff("/staff/settings");
  if (!(await isAdmin(user.id))) redirect("/staff/schedule");
  const [products, googleReview, plan] = await Promise.all([listProducts(), getSetting("review_url").catch(() => null), planPrices()]);
  const upsellCount = products.filter((p) => p.upsell).length;
  const have = new Set(products.map((p) => p.name.toLowerCase()));
  const suggestions = SUGGESTED_PRODUCTS.filter((s) => !have.has(s.name.toLowerCase()));
  const suggested = params.suggest !== undefined ? SUGGESTED_PRODUCTS[Number(params.suggest)] : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm uppercase tracking-widest text-muted">MPE team</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>

      <section id="plan" className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="plan-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="plan-heading" className="text-lg font-semibold">
            Maintenance plan
          </h2>
          <a href="/staff/plan" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">
            See members
          </a>
        </div>
        <p className="mt-1 text-sm text-muted">
          What it includes, as the site says: {PLAN_BENEFITS.map((b) => b.charAt(0).toLowerCase() + b.slice(1)).join(" and ")}. Set a monthly price, a yearly
          price or both. Leave one blank and it isn&rsquo;t offered. Members keep the price they joined at.
        </p>
        {params.planDone && <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">{params.planDone}</p>}
        {params.planError && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.planError}</p>}
        <form action={savePlanPrices} className="mt-4 grid gap-3 sm:grid-cols-3" data-plan-prices>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Monthly £</span>
            <input name="monthPrice" inputMode="decimal" defaultValue={pounds(plan.monthPence)} placeholder="Not offered" className={`${FIELD} text-right`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Yearly £</span>
            <input name="yearPrice" inputMode="decimal" defaultValue={pounds(plan.yearPence)} placeholder="Not offered" className={`${FIELD} text-right`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Minimum term, months (optional)</span>
            <input name="minMonths" inputMode="numeric" defaultValue={plan.minMonths || ""} placeholder="None" className={`${FIELD} text-right`} />
          </label>
          <p className="text-xs text-muted sm:col-span-3">
            With a minimum term, someone who cancels early stays on (and paying) until it&rsquo;s up. Worth setting for monthly members, so the free service
            isn&rsquo;t a one-month sign-up.
          </p>
          <button type="submit" className="min-h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 sm:col-span-3 sm:justify-self-start">
            Save plan prices
          </button>
        </form>
        {!plan.monthPence && !plan.yearPence && (
          <p className="mt-2 text-xs text-muted">No price yet: the plan&rsquo;s booking form still takes enquiries, but no one can join online.</p>
        )}
      </section>

      <section id="reviews" className="mt-8 scroll-mt-20 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-lg font-semibold">
          Google reviews
        </h2>
        <p className="mt-1 text-sm text-muted">
          After a job, customers rate it for you, then get a button to post a review on your Google Business Profile. Everyone gets the button,
          whatever they rated: only asking happy customers isn&rsquo;t allowed by Google.
        </p>
        <p className="mt-2 text-sm text-muted">
          To find the link: open your Google Business Profile (search &ldquo;my business&rdquo; on Google), tap <strong>Ask for reviews</strong>, and copy the link.
        </p>
        {params.reviewDone && <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">{params.reviewDone}</p>}
        {params.reviewError && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.reviewError}</p>}
        <form action={saveReviewLink} className="mt-4 flex flex-col gap-2 sm:flex-row" data-review-link>
          <label className="flex-1">
            <span className="sr-only">Google review link</span>
            <input name="reviewUrl" type="url" inputMode="url" defaultValue={googleReview ?? ""} placeholder="https://g.page/r/…/review" className={FIELD} />
          </label>
          <button type="submit" className="min-h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">
            Save
          </button>
        </form>
        {!googleReview && <p className="mt-2 text-xs text-muted">Until it&rsquo;s set, customers can still rate the job for you; they just aren&rsquo;t sent to Google.</p>}
      </section>

      <section id="products" className="mt-8 scroll-mt-20" aria-labelledby="products-heading">
        <h2 id="products-heading" className="text-lg font-semibold">
          Products and prices
        </h2>
        <p className="mt-1 text-sm text-muted">
          What you sell, at your prices. They&rsquo;re one-tap lines when you take payment. Tick up to {MAX_UPSELLS} to offer at repairs: the customer
          sees them on their invoice as an extra they can tick, at your repair price.
        </p>

        {params.done && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success" data-flash>{params.done}</p>}
        {params.error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">{params.error}</p>}

        <p className="mt-4 text-sm font-medium" data-upsell-count>
          Offered at repairs: {upsellCount} of {MAX_UPSELLS}
        </p>

        <ul className="mt-3 flex flex-col gap-3">
          {products.length === 0 && (
            <li className="rounded-2xl border border-border bg-surface/50 p-6 text-center text-sm text-muted">No products yet. Add one below, or start from a suggestion.</li>
          )}
          {products.map((p) => (
            <ProductRow key={p.id} p={p} canTick={p.upsell || upsellCount < MAX_UPSELLS} />
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6" id="add">
          <h3 className="font-semibold">Add a product</h3>
          <form action={addProduct} className="mt-4 grid gap-3 sm:grid-cols-2" data-add-product key={params.suggest ?? "new"}>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-muted">Name</span>
              <input name="name" required maxLength={80} defaultValue={suggested?.name ?? params.name ?? ""} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-muted">Description (optional)</span>
              <input name="description" maxLength={160} defaultValue={suggested?.description ?? ""} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Price £</span>
              <input name="price" required inputMode="decimal" defaultValue={pounds(suggested?.pricePence)} placeholder="0.00" className={`${FIELD} text-right`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Price at a repair £ (optional, about 20% off if blank)</span>
              <input name="upsellPrice" inputMode="decimal" placeholder="Auto" className={`${FIELD} text-right`} />
            </label>
            <button type="submit" className="min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90 sm:col-span-2 sm:justify-self-start">
              Add product
            </button>
          </form>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-6" data-suggestions>
            <h3 className="font-semibold">Good to offer at a repair</h3>
            <p className="mt-1 text-sm text-muted">Quick jobs while the boiler&rsquo;s open, with a good margin. Add the ones you do, at your prices.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {suggestions.map((s) => (
                <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {s.name}
                      {s.pricePence ? <span className="font-normal text-muted"> · from {formatPence(s.pricePence)} on the site</span> : null}
                    </span>
                    <span className="block text-xs text-muted">{s.why}</span>
                  </span>
                  <a
                    href={`/staff/settings?suggest=${SUGGESTED_PRODUCTS.indexOf(s)}#add`}
                    className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-semibold hover:border-foreground/40"
                  >
                    Add
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ProductRow({ p, canTick }: { p: Product; canTick: boolean }) {
  const offer = p.upsellPricePence ?? defaultUpsellPrice(p.pricePence);
  return (
    <li className={`rounded-2xl border p-4 ${p.upsell ? "border-accent/50 bg-accent/5" : "border-border bg-surface"}`} data-product={p.upsell ? "upsell" : "product"}>
      <form action={saveProduct.bind(null, p.id)} className="grid gap-3 sm:grid-cols-[1fr_7rem_8rem]">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Name</span>
          <input name="name" required maxLength={80} defaultValue={p.name} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Price £</span>
          <input name="price" required inputMode="decimal" defaultValue={pounds(p.pricePence)} className={`${FIELD} text-right`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">At a repair £</span>
          <input name="upsellPrice" inputMode="decimal" defaultValue={pounds(p.upsellPricePence)} placeholder={pounds(defaultUpsellPrice(p.pricePence))} className={`${FIELD} text-right`} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className="text-xs text-muted">Description (optional)</span>
          <input name="description" maxLength={160} defaultValue={p.description ?? ""} className={FIELD} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <button type="submit" className="min-h-11 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
            Save
          </button>
          <span className="text-xs text-muted">
            At a repair: {formatPence(offer)} ({Math.round((1 - offer / p.pricePence) * 100)}% off)
          </span>
        </div>
      </form>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <form action={toggleUpsell.bind(null, p.id, !p.upsell)}>
          <button
            type="submit"
            disabled={!canTick}
            aria-pressed={p.upsell}
            title={canTick ? undefined : `Untick one first: up to ${MAX_UPSELLS} at a repair`}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
              p.upsell ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-foreground/40"
            }`}
          >
            {p.upsell ? "✓ Offered at repairs" : "Offer at repairs"}
          </button>
        </form>
        <form action={removeProduct.bind(null, p.id)}>
          <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-medium text-danger hover:bg-danger/10">
            Remove
          </button>
        </form>
      </div>
    </li>
  );
}
