"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GlassButton, GoogleIcon, GitHubIcon } from "@/components/auth/SocialButtons";

export default function LoginEmailStep() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";

  const goPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    // Pass email via query param
    const q = new URLSearchParams({ email }).toString();
    router.push(`/auth/login/password?${q}`);
  };

  const loginWithGoogle = async () => {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
  };

  const loginWithGitHub = async () => {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${origin}/auth/callback` },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50">
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(60%_30%_at_50%_0%,rgba(59,130,246,0.15),transparent)]" />

      <section className="relative z-[1] max-w-md mx-auto px-6 pt-16">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Sense the Dense" className="h-12 w-12 rounded-2xl shadow-lg object-contain" />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">Sense the Dense</h1>
          <p className="text-sm text-gray-600">Crowd-aware maps for safer movement</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 space-y-4">
          <GlassButton onClick={loginWithGoogle} disabled={busy}>
            <GoogleIcon /> Continue with Google
          </GlassButton>
          <GlassButton onClick={loginWithGitHub} disabled={busy}>
            <GitHubIcon /> Continue with GitHub
          </GlassButton>

          <div className="flex items-center gap-4">
            <div className="h-px bg-black/10 w-full" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px bg-black/10 w-full" />
          </div>

          {/* Email-only step */}
          <form onSubmit={goPassword} className="space-y-3">
            <label className="text-sm font-semibold text-gray-800">Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
            />
            <button
              className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98]"
            >
              Login
            </button>
          </form>

          <div className="text-xs text-gray-600 pt-2">
            Didn’t have an account?{" "}
            <a href="/auth/signup" className="text-blue-700 underline">Sign up</a>
          </div>
        </div>
      </section>
    </main>
  );
}
