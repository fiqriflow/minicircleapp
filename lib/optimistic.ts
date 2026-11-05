import { toast } from "sonner";

type Res = { error?: { message?: string } | null };

export type OptimisticOptions<R extends Res> = {
  /** Ubah tampilan SEKARANG (setState). Wajib mengembalikan fungsi rollback yang memulihkan keadaan semula. */
  apply: () => () => void;
  /** Kirim ke server (di belakang layar). */
  run: () => PromiseLike<R>;
  /** Default: gagal kalau res.error ada. Isi kalau ada kasus gagal lain (mis. RLS menolak = 0 baris). */
  failed?: (res: R) => boolean;
  /** Pesan toast saat gagal (default: res.error.message). */
  errorMessage?: (res: R) => string | undefined;
  /** Return true kalau error sudah ditangani sendiri (toast default dilewati). */
  onError?: (res: R | null, thrown?: unknown) => boolean | void;
  onSuccess?: (res: R) => void;
  /** Selalu dipanggil di akhir (sukses/gagal): cocok untuk sinkron ulang dari server. */
  onSettled?: (ok: boolean) => void;
};

/**
 * Optimistic UI: layar langsung berubah, server menyusul. Gagal / error jaringan -> rollback otomatis + toast.
 * Pola pakai: simpan nilai lama di `apply`, kembalikan fungsi yang memasangnya lagi.
 */
export async function optimistic<R extends Res>(opts: OptimisticOptions<R>): Promise<{ ok: boolean; res: R | null }> {
  const rollback = opts.apply();
  let res: R | null = null;
  let thrown: unknown;
  try {
    res = await opts.run();
  } catch (e) {
    thrown = e;
  }

  const failed = thrown !== undefined || !res || (opts.failed ? opts.failed(res) : !!res.error);
  if (failed) {
    rollback();
    const handled = opts.onError?.(res, thrown);
    if (!handled) {
      const msg = (res && opts.errorMessage?.(res)) || res?.error?.message || "Koneksi bermasalah, coba lagi.";
      toast.error(msg);
    }
    opts.onSettled?.(false);
    return { ok: false, res };
  }

  opts.onSuccess?.(res as R);
  opts.onSettled?.(true);
  return { ok: true, res };
}

/** ID sementara untuk item yang belum tersimpan di server. */
export const tempId = () => `tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const isTempId = (id: unknown) => typeof id === "string" && id.startsWith("tmp-");
