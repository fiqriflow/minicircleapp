// Pecah array jadi potongan kecil. Dipakai untuk query `.in("id", [...])` supaya URL request
// tidak kepanjangan (batas ~8 KB; satu UUID ~37 karakter -> ~200 id sudah bisa gagal).
export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
