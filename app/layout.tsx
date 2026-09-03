import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "Mincle",
  description: "Cari dan gabung circle olahraga favoritmu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
