// Kompres gambar di browser SEBELUM upload -> hemat storage & egress Supabase.
// Output WebP (fallback JPEG kalau browser tidak support). GIF dilewati (animasi).
export type CompressResult = { blob: Blob; ext: "webp" | "jpg"; contentType: string };

export async function compressImage(
  file: File | Blob,
  opts: { maxSize?: number; quality?: number } = {}
): Promise<CompressResult> {
  const maxSize = opts.maxSize ?? 1280; // sisi terpanjang (px)
  const quality = opts.quality ?? 0.8;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.fillStyle = "#fff"; // PNG transparan -> latar putih (aman untuk JPEG fallback)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  let blob = await toBlob(canvas, "image/webp", quality);
  let ext: "webp" | "jpg" = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob(canvas, "image/jpeg", quality);
    ext = "jpg";
  }
  if (!blob) throw new Error("Gagal kompres gambar");

  // kalau hasil malah lebih besar dari file asli (jarang), pakai asli
  if (blob.size >= file.size && file.type.startsWith("image/") && scale === 1) {
    const origExt = file.type === "image/webp" ? "webp" : "jpg";
    if (file.type === "image/webp" || file.type === "image/jpeg") {
      return { blob: file, ext: origExt, contentType: file.type };
    }
  }
  return { blob, ext, contentType: blob.type };
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fallback ke <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Gambar tidak valid"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, type, q));
}

// Cache panjang aman: semua URL punya ?t=timestamp / path unik.
export const LONG_CACHE = "31536000";
