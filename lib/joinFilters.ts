// Filter peserta Circle+ (gender, generasi/tahun lahir, verified). Dipakai form buat circle & halaman detail.
export const GENERATIONS = [
  { key: "genz", label: "Gen Z (lahir 1997–2012)", short: "Gen Z", min: 1997, max: 2012 },
  { key: "milenial", label: "Milenial (lahir 1981–1996)", short: "Milenial", min: 1981, max: 1996 },
] as const;

export function generationKey(min?: number | null, max?: number | null): string {
  if (min == null && max == null) return "";
  const g = GENERATIONS.find((x) => x.min === min && x.max === max);
  return g ? g.key : "custom";
}

export function yearRangeLabel(min?: number | null, max?: number | null): string {
  const g = GENERATIONS.find((x) => x.min === min && x.max === max);
  if (g) return g.short;
  if (min != null && max != null) return `Lahir ${min}–${max}`;
  if (min != null) return `Lahir ${min}+`;
  return `Lahir ≤ ${max}`;
}

export function hasJoinFilters(c: any): boolean {
  return !!(c?.join_gender || c?.join_birth_year_min != null || c?.join_birth_year_max != null || c?.join_verified_only);
}
