"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";
import LottieMascot from "@/components/ui/LottieMascot";

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
        <LottieMascot
          src="/login.json"
          className="absolute bottom-0 left-0 w-[62%] max-w-[300px] aspect-[489/314] translate-y-[6%]"
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
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white shrink-0">
              <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </span>
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
