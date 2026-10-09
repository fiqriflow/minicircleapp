"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

function LoginPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const notice = searchParams.get("notice");
    const keepNext = safeNext(searchParams.get("next"));
    const loginUrl = keepNext ? `/login?next=${encodeURIComponent(keepNext)}` : "/login";
    if (notice === "already-registered") {
      toast.error("Email ini sudah terdaftar", {
        description: "Silakan klik \"Lanjutkan dengan Google\" untuk masuk.",
      });
      router.replace(loginUrl);
    }
    // FIX: sebelumnya kegagalan proses login/daftar (mis. tukar kode gagal,
    // cookie diblokir browser tertentu, user cancel consent) diam-diam
    // dilempar balik ke sini tanpa pesan apa pun -> user cuma lihat halaman
    // login lagi (kelihatan kayak "loop"). Sekarang dikasih tau jelas.
    if (notice === "auth-failed") {
      const reason = searchParams.get("reason")?.slice(0, 120);
      toast.error("Gagal masuk dengan Google", {
        description: reason
          ? `Penyebab: ${reason}. Coba lagi, atau pakai browser lain kalau masih gagal.`
          : "Coba lagi ya. Kalau masih gagal, coba pakai browser lain (Chrome/Safari) dan pastikan cookie tidak diblokir.",
      });
      router.replace(loginUrl);
    }
  }, [searchParams, router]);

  // Satu alur untuk user lama & baru: user lama langsung masuk, user baru
  // otomatis diarahkan ke /onboarding oleh proxy.ts.
  const handleGoogleAuth = async () => {
    setLoading(true);
    const next = safeNext(searchParams.get("next"));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      },
    });
    // FIX: kalau signInWithOAuth sendiri gagal (mis. gagal simpen cookie
    // code_verifier karena browser HP tertentu blokir cookie), sebelumnya
    // gak ada feedback sama sekali ke user — tombol kelihatan gak ngapa2in.
    if (error) {
      setLoading(false);
      toast.error("Gagal membuka login Google", {
        description: "Pastikan cookie/penyimpanan situs tidak diblokir di browser ini, lalu coba lagi.",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <img src="/logo-login.svg" alt="mincle" className="h-28 mx-auto" />
          <p className="text-gray-500">Buat dan temukan circlemu.</p>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border rounded-xl py-3 font-medium hover:bg-gray-100 transition disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
            {loading ? "Membuka Google..." : "Lanjutkan dengan Google"}
          </button>
        </div>

        <p className="text-xs text-gray-400 px-2">
          Dengan melanjutkan, kamu setuju dengan{" "}
          <a href="/profile/syarat-ketentuan" className="underline">Syarat &amp; Ketentuan</a> dan{" "}
          <a href="/profile/kebijakan-privasi" className="underline">Kebijakan Privasi</a> kami.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
