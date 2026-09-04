import Link from "next/link";
import { Suspense } from "react";
import { Bike, Footprints, PersonStanding, Grid3x3 } from "lucide-react";
import HomeBannerSection from "@/components/HomeBannerSection";
import HomeUpcomingCircles from "@/components/HomeUpcomingCircles";

const QUICK_ACCESS = [
  { label: "Circle Lari", category: "Running", icon: Footprints },
  { label: "Circle Gowes", category: "Gowes", icon: Bike },
  { label: "Circle Jalan Santai", category: "Jalan Santai", icon: PersonStanding },
  { label: "Lainnya", category: null, icon: Grid3x3 },
];

export default function BerandaPage() {
  return (
    <div className="px-4 py-6 space-y-8">
      {/* Banner / Hero — gambar diatur dari halaman admin appearance */}
      <Suspense fallback={<div className="rounded-2xl bg-gray-100 h-40 animate-pulse" />}>
        <HomeBannerSection />
      </Suspense>

      {/* Quick Access — statis, render instan tanpa nunggu data */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Access</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACCESS.map(({ label, category, icon: Icon }) => (
            <Link
              key={label}
              href={category ? { pathname: "/explore", query: { category } } : "/explore"}
              className="flex flex-col items-center gap-2 bg-white border rounded-2xl p-3 hover:border-primary hover:bg-primary/5 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon size={20} />
              </div>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </section>

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
