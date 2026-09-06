import { Suspense } from "react";
import HomeBannerSection from "@/components/HomeBannerSection";
import HomeUpcomingCircles from "@/components/HomeUpcomingCircles";
import QuickAccessSection from "@/components/QuickAccessSection";
import CreateCircleBanner from "@/components/CreateCircleBanner";
import WelcomeDialog from "@/components/WelcomeDialog";

export default function BerandaPage() {
  return (
    <div className="px-4 py-6 space-y-8">
      <WelcomeDialog />

      {/* Banner / Hero — gambar diatur dari halaman admin appearance */}
      <Suspense fallback={<div className="rounded-2xl bg-gray-100 h-40 animate-pulse" />}>
        <HomeBannerSection />
      </Suspense>

      {/* Ajakan buat circle */}
      <CreateCircleBanner />

      {/* Circle yang tersedia — 3 kategori + Lihat Semua (link ke Explore) */}
      <QuickAccessSection />

      {/* Circle yang akan datang */}
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        }
      >
        <HomeUpcomingCircles />
      </Suspense>
    </div>
  );
}
