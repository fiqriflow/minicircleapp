// Template di-mount ulang tiap pindah halaman -> animasi masuk singkat (160ms).
// Berada DI ATAS loading.tsx, jadi animasi tampil di skeleton dan konten asli langsung ganti tanpa animasi lagi.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
