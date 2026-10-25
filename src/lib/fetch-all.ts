/**
 * Reads every row of a query, a page at a time. Supabase returns at most
 * 1000 rows per request, so a plain select quietly drops the rest once a
 * table grows past that. Pass a function that builds the query for a
 * given range.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  /** max: stop once this many are read. throwOnError: a failed page throws rather than returning what was read so far, for figures that would otherwise come out quietly low. */
  options: { max?: number; throwOnError?: boolean } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) {
      console.error("fetchAll: page failed", error);
      if (options.throwOnError) throw error;
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    if (options.max !== undefined && rows.length >= options.max) break;
  }
  return options.max !== undefined ? rows.slice(0, options.max) : rows;
}
