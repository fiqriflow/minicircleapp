"use client";

import { useEffect, useRef } from "react";

// Animasi Lottie (SVG renderer). lottie-web di-load lazy supaya tidak membebani bundle awal.
// Hormati "reduce motion": kalau aktif, tampil diam di frame pertama.
export default function LottieMascot({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let anim: { destroy: () => void } | null = null;

    (async () => {
      const lottie = (await import("lottie-web")).default;
      if (cancelled || !ref.current) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      anim = lottie.loadAnimation({
        container: ref.current,
        renderer: "svg",
        loop: true,
        autoplay: !reduceMotion,
        path: src,
        rendererSettings: { preserveAspectRatio: "xMidYMax meet" },
      });
    })().catch((err) => console.error("Lottie gagal dimuat:", err));

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [src]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
