// src/app/auth/login/password/password-client.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const emailFromQuery = sp.get("email") || "";
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // keep input in sync if URL changes (rare, but correct)
  useEffect(() => {
    if (emailFromQuery && emailFromQuery !== email) setEmail(emailFromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromQuery]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.replace("/map");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50">
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(60%_30%_at_50%_0%,rgba(59,130,246,0.15),transparent)]" />
      <section className="relative z-[1] max-w-md mx-auto px-6 pt-20">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="Sense the Dense"
            className="h-12 w-12 rounded-2xl shadow-lg object-contain"
          />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">
            Enter your password
          </h1>
          <p className="text-sm text-gray-600 mt-1">{email || "Your email"}</p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 space-y-4">
          <form onSubmit={onSubmit} className="space-y-3">
            {/* Email (readonly if from query) */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={Boolean(emailFromQuery)}
                className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70 disabled:opacity-60"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
              />
            </div>

            <button
              disabled={loading}
              className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
            <a
              href={`/auth/reset${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="text-blue-700 underline"
            >
              Forgot password?
            </a>
            <a href="/auth/signup" className="text-blue-700 underline">
              Didn’t have an account?
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
