export const MAX_ENERGY = 7;

export type EnergyInfo = {
  energy: number;
  energyResetAt: string | null;
};

/** Ambil energy TERKINI milik user yang login (sekalian lazy-reset kalau sudah lewat Senin 00:00 WIB). */
export async function getMyEnergy(supabase: any): Promise<EnergyInfo> {
  const { data, error } = await supabase.rpc("get_my_energy").single();
  if (error || !data) return { energy: MAX_ENERGY, energyResetAt: null };
  return { energy: data.energy ?? MAX_ENERGY, energyResetAt: data.energy_reset_at ?? null };
}

/** Label "Senin, 14 Sep 00:00" untuk reset mingguan berikutnya (WIB, UTC+7 tetap). */
export function getNextResetLabel(): string {
  const now = new Date();
  const wibNow = new Date(now.getTime() + 7 * 60 * 60 * 1000); // geser ke WIB
  const dow = wibNow.getUTCDay(); // 0=Minggu..6=Sabtu (pakai getUTC* krn sudah digeser manual)
  const daysUntilMonday = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  const nextMondayWib = new Date(
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + daysUntilMonday, 0, 0, 0)
  );
  const nextMondayUtc = new Date(nextMondayWib.getTime() - 7 * 60 * 60 * 1000);
  return nextMondayUtc.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jakarta",
  });
}

/** Ubah pesan error dari DB (trigger energy habis) jadi pesan ramah kalau cocok, selain itu null. */
export function mapEnergyError(message: string | undefined | null): string | null {
  if (!message) return null;
  if (message.toLowerCase().includes("energy")) {
    return "Energy kamu sudah habis, jadi belum bisa buat circle baru. Energy reset otomatis tiap Senin jam 00:00 ya.";
  }
  return null;
}
