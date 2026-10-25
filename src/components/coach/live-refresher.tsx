"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps a server-rendered admin page current without a manual refresh —
 * re-runs the page's data fetch on an interval. Renders nothing. Used
 * anywhere showing near-real-time data (live visitor counts, current page)
 * that would otherwise go stale until the coach happened to reload.
 */
export function LiveRefresher({ intervalMs = 12_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
