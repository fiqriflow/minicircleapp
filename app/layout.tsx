import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "Mabar Circle",
  description: "Cari dan gabung circle olahraga favoritmu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <BottomNav />
        <main className="pb-20 md:pb-8">{children}</main>
      </body>
    </html>
  );
}
