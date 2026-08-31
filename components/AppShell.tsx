"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBareLayout = pathname === "/login";

  if (isBareLayout) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <BottomNav />
      <main className="pb-20 md:pb-8">{children}</main>
    </>
  );
}
