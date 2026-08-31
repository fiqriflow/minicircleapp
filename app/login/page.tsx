"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [mode, setMode] = useState<"google" | "password">("google");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  const handlePasswordLogin = async () => {
    if (!username || !password) {
      setError("Isi username dan password dulu ya.");
      return;
    }
    setLoading(true);
    setError("");

    // 1. Cari email dari username
    const { data: email, error: lookupError } = await supabase.rpc("get_email_by_username", {
      p_username: username.trim(),
    });

    if (lookupError || !email) {
      setError("Username tidak ditemukan.");
      setLoading(false);
      return;
    }

    // 2. Login pakai email + password
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (loginError) {
      setError("Username atau password salah.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <h1 className="text-3xl font-bold text-primary">Mabar Circle</h1>
        <p className="text-gray-500">Cari dan gabung circle olahraga favoritmu.</p>

        {mode === "google" ? (
          <>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 border rounded-xl py-3 font-medium hover:bg-gray-100 transition"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="google" />
              Masuk dengan Google
            </button>
            <button
              onClick={() => setMode("password")}
              className="text-sm text-gray-500 underline"
            >
              Masuk pakai Username & Password
            </button>
          </>
        ) : (
          <div className="space-y-3 text-left">
            <input
              className="w-full border rounded-xl px-4 py-2"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
            />
            <input
              type="password"
              className="w-full border rounded-xl px-4 py-2"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handlePasswordLogin}
              disabled={loading}
              className="w-full bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
            <button
              onClick={() => {
                setMode("google");
                setError("");
              }}
              className="w-full text-sm text-gray-500 underline text-center"
            >
              Kembali ke Login Google
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Belum punya username & password? Login dulu pakai Google, lalu atur di halaman Profil.
        </p>
      </div>
    </div>
  );
}
