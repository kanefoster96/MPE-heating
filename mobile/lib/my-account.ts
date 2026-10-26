import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiFetch, apiPost, readCached } from "@/lib/api";
import { openInApp } from "@/lib/open-link";
import { notify } from "@/lib/confirm";

/** A customer's own account, from /api/mobile/account/me (src/lib/app-account.ts on the site). */
export type MyAccount =
  | { customer: false; today: string }
  | {
      customer: true;
      today: string;
      name: string | null;
      payments: { id: string; title: string; detail: string; monthly: string | null; failed: boolean; amount: string; status: string; paid: boolean; url: string }[];
      paysMonthly: boolean;
      planPayments: { id: string; when: string; amount: string; status: "paid" | "open" | "other"; url: string | null }[];
      quotes: { id: string; title: string; detail: string; amount: string; status: string; tone: "good" | "open" | "plain"; url: string }[];
      certificates: { id: string; label: string; detail: string; url: string | null }[];
      photos: { id: string; label: string; url: string | null }[];
      plan:
        | { on: true; benefits: string[]; status: string; tone: "good" | "bad" | "plain"; line: string; failed: boolean; leaving: boolean; cancelNote: string }
        | { on: false; benefits: string[]; line: string }
        | null;
      cardsOn: boolean;
      cards: { id: string; label: string; detail: string; expired: boolean; removable: boolean }[];
      refer: { link: string; line: string; share: string; referred: number; credit: string | null } | null;
      request: { kinds: { key: string; label: string }[]; parts: { key: string; label: string }[]; last: string };
      fields: Record<string, string>;
    };

export const MY_ACCOUNT = "/api/mobile/account/me";

/** Their account, kept fresh each time a screen of it is opened (and after a Stripe page closes). */
export function useMyAccount() {
  const [data, setData] = useState<MyAccount | null>(() => readCached<MyAccount>(MY_ACCOUNT) ?? null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<MyAccount>(MY_ACCOUNT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your account.");
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return { data, error, load };
}

/** An account action: a message to show, or a page (Stripe, the plan) to open in the app. */
export async function accountAction(body: Record<string, unknown>): Promise<{ message?: string } | null> {
  try {
    const res = await apiPost<{ message?: string; url?: string }>(MY_ACCOUNT, body);
    if (res.url) await openInApp(res.url);
    return res;
  } catch (err) {
    notify("Not done", err instanceof Error ? err.message : "Please try again.");
    return null;
  }
}
