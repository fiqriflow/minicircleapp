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
    <div className="relative min-h-[100dvh] overflow-hidden bg-gray-50 flex flex-col items-center justify-center px-6">
      {/* Ilustrasi bawah: kota + maskot (dekoratif, tidak menghalangi klik) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[330px] overflow-hidden"
      >
        <img
          src="/bgbawah.svg"
          alt=""
          className="absolute bottom-0 right-0 w-[80%] translate-y-[28%] select-none"
        />
        <img
          src="/maskot_login.svg"
          alt=""
          className="absolute bottom-0 left-0 w-[58%] max-w-[260px] -translate-x-[6%] translate-y-[20%] select-none"
        />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <img src="/logo-login.svg" alt="mincle" className="h-28 mx-auto" />
          <p className="text-gray-500">Buat dan temukan circlemu.</p>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-6 space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">Login atau Sign Up</h1>
          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark active:scale-[0.99] transition disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
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
