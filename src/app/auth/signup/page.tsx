"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { GlassButton, GoogleIcon, GitHubIcon } from "@/components/auth/SocialButtons";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  const signupEmailPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return alert(error.message);
    // If email confirmations are ON, user gets confirmation link.
    router.replace("/auth/login");
  };

  const oauth = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin}/auth/callback` },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50">
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(60%_30%_at_50%_0%,rgba(59,130,246,0.15),transparent)]" />
      <section className="relative z-[1] max-w-md mx-auto px-6 pt-20">
        {/* Logo + Title */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Sense the Dense Logo"
            width={72}
            height={72}
            className="mb-3 rounded-xl"
            priority
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Sense the Dense
          </h1>
          <p className="text-gray-600 text-sm mt-1">Create your account</p>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 space-y-4">
          <GlassButton onClick={() => oauth("google")}>
            <GoogleIcon /> Sign up with Google
          </GlassButton>
          <GlassButton onClick={() => oauth("github")}>
            <GitHubIcon /> Sign up with GitHub
          </GlassButton>

          <div className="flex items-center gap-4">
            <div className="h-px bg-black/10 w-full" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px bg-black/10 w-full" />
          </div>

          <form onSubmit={signupEmailPwd} className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
              />
            </div>
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
              className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98]"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>

          <div className="text-xs text-gray-600 pt-2">
            Already have an account?{""}
            <a href="/auth/login" className="text-blue-700 underline">
              Log in
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
