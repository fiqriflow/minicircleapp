"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-3xl font-bold text-primary">Mabar Circle</h1>
        <p className="text-gray-500">Cari dan gabung circle olahraga favoritmu.</p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border rounded-xl py-3 font-medium hover:bg-gray-100 transition"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
          Masuk dengan Google
        </button>
      </div>
    </div>
  );
}
