// Sistem energy = saldo kredit. Angka ini HARUS sama dengan yang di migration 0032
// (DB yang menegakkan; konstanta ini cuma untuk tampilan & pengecekan awal di UI).
export const INITIAL_ENERGY = 1000;
export const DAILY_ENERGY_BONUS = 50;
export const ENERGY_COST = {
  join: 1,
  create: 10,
  createPlus: 100,
} as const;

export type EnergyInfo = {
  energy: number;
  energyResetAt: string | null;
};

/** Ambil energy TERKINI milik user yang login (sekalian hitung bonus harian yang tertunda). */
export async function getMyEnergy(supabase: any): Promise<EnergyInfo> {
  const { data, error } = await supabase.rpc("get_my_energy").single();
  // gagal baca -> jangan blokir UI; DB tetap yang menolak kalau energy memang kurang
  if (error || !data) return { energy: INITIAL_ENERGY, energyResetAt: null };
  return { energy: data.energy ?? INITIAL_ENERGY, energyResetAt: data.energy_reset_at ?? null };
}

/** Label "Kamis, 9 Oktober" untuk bonus harian berikutnya (00.00 WIB, UTC+7 tetap). */
export function getNextBonusLabel(): string {
  const now = new Date();
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000); // geser ke WIB
  const tomorrowWib = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + 1, 0, 0, 0);
  const tomorrowUtc = new Date(tomorrowWib - 7 * 60 * 60 * 1000);
  return tomorrowUtc.toLocaleDateString("id-ID", {
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

/** Beri tahu EnergyBadge (dan komponen lain) supaya baca ulang saldo setelah aksi yang memotong energy. */
export function notifyEnergyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("energy-changed"));
}
