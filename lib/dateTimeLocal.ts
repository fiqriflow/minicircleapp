// Helper konversi antara <input type="datetime-local"> (merepresentasikan
// waktu lokal browser, TANPA info zona waktu) dan ISO string UTC yang
// disimpan di kolom timestamptz Supabase.
//
// Tanpa helper ini, string dari datetime-local (mis. "2026-09-05T18:00")
// dikirim apa adanya ke Supabase dan diperlakukan sebagai UTC, sehingga jam
// yang tersimpan meleset sejauh offset timezone user (mis. -7 jam untuk WIB).

/** ISO string (UTC) dari database -> value untuk <input type="datetime-local"> (waktu lokal) */
export function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** value dari <input type="datetime-local"> (waktu lokal) -> ISO string UTC untuk disimpan */
export function fromDateTimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
