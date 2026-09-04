import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";

export const metadata = {
  title: "Mincle",
  description: "Buat dan temukan circlemu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
