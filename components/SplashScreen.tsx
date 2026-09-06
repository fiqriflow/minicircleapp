"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SESSION_KEY = "mincle_splash_shown";
const MIN_VISIBLE_MS = 1400;
const FADE_MS = 350;

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage bisa gagal (private mode dsb), anggap belum tampil
    }

    if (alreadyShown) return;

    setVisible(true);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(() => setVisible(false), FADE_MS);
    }, MIN_VISIBLE_MS);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted || !visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-primary transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <div className="relative w-40 h-40 animate-[splashPop_.5s_ease-out]">
        <Image src="/logo-white.svg" alt="mincle" fill priority className="object-contain" />
      </div>

      <div className="absolute bottom-10 flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-white/70 animate-bounce" />
      </div>
    </div>
  );
}
