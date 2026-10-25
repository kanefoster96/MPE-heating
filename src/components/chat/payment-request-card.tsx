"use client";

import { useCallback, useEffect, useState } from "react";

type View = {
  id: string;
  kind: "callout_fee" | "invoice" | "other";
  number: number;
  description: string;
  amountPence: number;
  status: "open" | "paid" | "cancelled";
  paidAt: string | null;
  paidVia: string | null;
  payUrl: string;
  canPay: boolean;
  canManage: boolean;
  savedCard?: { brand: string; last4: string } | null;
};

const VIA: Record<string, string> = {
  link: "online",
  app: "in the app",
  saved_card: "saved card",
  tap_to_pay: "Tap to Pay",
  in_person: "card machine",
  cash: "cash",
  bank_transfer: "bank transfer",
};

function formatPence(pence: number): string {
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds.toLocaleString("en-GB") : pounds.toFixed(2)}`;
}

async function fetchView(id: string, withCard = false): Promise<View | null> {
  try {
    const res = await fetch(`/api/payment-requests/${id}${withCard ? "?card=1" : ""}`, { cache: "no-store" });
    const body = await res.json().catch(() => null);
    return res.ok && body?.request ? (body.request as View) : null;
  } catch {
    return null;
  }
}

/**
 * A call-out fee or invoice in the chat (lib/payments.ts), in place of the
 * message's text and link: Kanvas Academy's payment request card. The
 * customer sees Pay; the team sees whether it's paid, and can charge the
 * saved card, mark it paid in person, or cancel. Checks again every few
 * seconds while it's open, so it turns to Paid by itself.
 */
export function PaymentRequestCard({ id, fallback }: { id: string; fallback: React.ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await fetchView(id);
    if (next) setView((current) => ({ ...next, savedCard: current?.savedCard ?? next.savedCard }));
    else setFailed(true);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void fetchView(id, true).then((next) => {
      if (cancelled) return;
      if (next) setView(next);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (view?.status !== "open") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => clearInterval(timer);
  }, [view?.status, load]);

  async function act(kind: "pay" | "charge" | "cancel" | "paid") {
    if (!view) return;
    if (kind === "charge" && !window.confirm(`Charge ${formatPence(view.amountPence)} to their ${view.savedCard?.brand} ending ${view.savedCard?.last4} now?`)) return;
    if (kind === "paid" && !window.confirm("Mark this as paid in person (card machine)?")) return;
    if (kind === "cancel" && !window.confirm("Cancel this? They won't be able to pay it.")) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/payment-requests/${id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "paid" ? { via: "in_person" } : {}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "That didn't work. Please try again.");
      else if (kind === "pay" && body?.url) {
        window.location.href = body.url as string;
        return;
      }
      await load();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!view) return <>{failed ? fallback : <div className="h-20 w-56 animate-pulse rounded-xl bg-foreground/5" />}</>;

  const title = view.kind === "callout_fee" ? "Call-out fee" : `Invoice MPE-${view.number}`;
  return (
    <div className="flex w-60 max-w-full flex-col gap-1 px-1 py-1" data-payment-card={view.status}>
      <span className="text-xs text-muted">
        {title}
        {view.kind !== "callout_fee" ? ` · ${view.description}` : ""}
      </span>
      <span className="text-2xl font-bold tracking-tight">{formatPence(view.amountPence)}</span>
      {view.status === "paid" ? (
        <span className="mt-1 text-sm font-medium text-success">
          Paid ✓{view.paidVia ? ` · ${VIA[view.paidVia] ?? ""}` : ""}
        </span>
      ) : view.status === "cancelled" ? (
        <span className="mt-1 text-sm text-muted">Cancelled</span>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {!view.canManage && (
            <a
              href={view.payUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Pay {formatPence(view.amountPence)}
            </a>
          )}
          {view.canManage && (
            <>
              <span className="text-xs text-muted">Waiting for them to pay</span>
              {view.savedCard && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act("charge")}
                  className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busy === "charge" ? "Charging…" : `Charge ${view.savedCard.brand} ending ${view.savedCard.last4}`}
                </button>
              )}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void act("paid")}
                className="min-h-9 rounded-full border border-border px-4 text-xs font-medium transition-colors hover:border-foreground/40 disabled:opacity-60"
              >
                Paid in person
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void act("cancel")}
                className="min-h-9 text-left text-xs text-muted underline underline-offset-2 hover:text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
