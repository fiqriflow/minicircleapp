import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import { Toaster } from "sonner";
import SplashScreen from "@/components/SplashScreen";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Mincle",
  description: "Buat dan temukan circlemu",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mincle",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F46113",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <SplashScreen />
        <AppShell>{children}</AppShell>
        <Toaster position="top-center" richColors closeButton />
        <PwaRegister />
      </body>
    </html>
  );
}
