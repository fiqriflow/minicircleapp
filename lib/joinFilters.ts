// Filter peserta Circle+ (gender, verified). Dipakai form buat circle & halaman detail.
export function hasJoinFilters(c: any): boolean {
  return !!(c?.join_gender || c?.join_verified_only);
}
