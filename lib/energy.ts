// Sistem energy = saldo kredit. Angka ini HARUS sama dengan yang di migration 0032
// (DB yang menegakkan; konstanta ini cuma untuk tampilan & pengecekan awal di UI).
export const INITIAL_ENERGY = 1000;
/** Saldo di-reset ke angka ini tiap Senin 00.00 WIB (bukan menambah; sisa lama hangus). Migration 0065. */
export const WEEKLY_ENERGY_RESET = 1000;
export const ENERGY_COST = {
  join: 100,
  create: 100,
  createPlus: 200,
} as const;
/** Penalti pelanggaran / tidak check-in (potong energi saat circle selesai). Harus sama dengan migration 0065. */
export const NO_SHOW_PENALTY = 50;

export type EnergyInfo = {
  energy: number;
  energyResetAt: string | null;
  /** true = gagal baca saldo dari DB; `energy` hanya nilai default, jangan ditampilkan sebagai saldo asli */
  failed?: boolean;
};

/** Ambil energy TERKINI milik user yang login (sekalian hitung bonus harian yang tertunda). */
export async function getMyEnergy(supabase: any): Promise<EnergyInfo> {
  const { data, error } = await supabase.rpc("get_my_energy").single();
  // gagal baca -> jangan blokir UI; DB tetap yang menolak kalau energy memang kurang
  if (error || !data) return { energy: INITIAL_ENERGY, energyResetAt: null, failed: true };
  return { energy: data.energy ?? INITIAL_ENERGY, energyResetAt: data.energy_reset_at ?? null };
}

/** Label "Senin, 9 November" untuk reset energy berikutnya (Senin 00.00 WIB, UTC+7 tetap). */
export function getNextResetLabel(): string {
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000); // geser ke WIB
  const dow = wibNow.getUTCDay(); // 0=Minggu .. 1=Senin
  const daysToMonday = ((8 - dow) % 7) || 7;
  const nextWib = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + daysToMonday, 0, 0, 0);
  const nextUtc = new Date(nextWib - 7 * 60 * 60 * 1000);
  return nextUtc.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  });
}

/** Pesan error dari DB soal energy -> tampilkan apa adanya (sudah ramah); selain itu null. */
export function mapEnergyError(message: string | undefined | null): string | null {
  if (!message) return null;
  if (message.toLowerCase().includes("energy kamu tidak cukup")) return message;
  return null;
}

/**
 * Beri tahu EnergyBadge (dan komponen lain).
 * - tanpa argumen: baca ulang saldo asli dari server (dipanggil setelah aksi selesai / gagal)
 * - { delta }: ubah saldo di layar SEKARANG (optimistic), nanti disinkronkan lagi oleh panggilan tanpa argumen
 */
export function notifyEnergyChanged(opts?: { delta?: number }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("energy-changed", { detail: { delta: opts?.delta } }));
}
