// PostgREST membatasi 1000 baris per request. Helper ini mengambil bertahap (range 0-999, 1000-1999, ...)
// supaya daftar admin tidak terpotong. Query WAJIB punya order yang deterministik (mis. + .order("id")).
export async function fetchAllPages<T = any>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: any; error: any }>
): Promise<{ data: T[]; error: any }> {
  const PAGE = 1000;
  const rows: T[] = [];
  for (let i = 0; i < 100; i++) {
    const { data, error } = await makeQuery(i * PAGE, i * PAGE + PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { data: rows, error: null };
}
