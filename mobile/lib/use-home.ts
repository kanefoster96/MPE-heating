import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiGet, readCached } from "@/lib/api";
import type { HomeData } from "@/lib/types";

const HOME_PATH = "/api/mobile/home";

/**
 * The site's services, prices and guides (/api/mobile/home), shared by
 * Home, All services and the guide search. Paints the last copy at once and
 * refreshes each time the screen comes into view.
 */
export function useHomeData() {
  const [data, setData] = useState<HomeData | null>(() => readCached<HomeData>(HOME_PATH) ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiGet<HomeData>(HOME_PATH));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, load };
}
