"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleAuth = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">Mincle</h1>
          <p className="text-gray-500">Buat dan temukan circlemu.</p>
        </div>

        <button
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 border rounded-xl py-3 font-medium hover:bg-gray-100 transition"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
          Masuk dengan Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">atau</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-500">Belum punya akun?</p>
          <button
            onClick={handleGoogleAuth}
            className="w-full flex items-center justify-center gap-3 bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark transition"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="google" />
            Daftar dengan Google
          </button>
        </div>
      </div>
    </div>
  );
}
