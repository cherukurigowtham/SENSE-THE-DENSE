"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPasswordStep() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const e = sp.get("email") || "";
    if (!e) router.replace("/auth/login");
    setEmail(e);
  }, [sp, router]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);

    if (error) {
      // Supabase returns "Email not confirmed" (or similar) if user exists but not verified.
      if (/confirm|verified/i.test(error.message)) {
        setErrorMsg("Your email isn’t confirmed yet. Please check your inbox for the confirmation link.");
        return;
      }
      setErrorMsg(error.message);
      return;
    }

    if (data.session) {
      router.replace("/map");
    } else {
      setErrorMsg("Unexpected error. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50 grid place-items-center">
      <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 w-[min(460px,92vw)]">
        {/* Brand row */}
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.png" alt="Sense the Dense" className="h-8 w-8 rounded-xl object-contain" />
          <div>
            <h1 className="text-lg font-extrabold text-gray-900">Welcome back</h1>
            <p className="text-xs text-gray-600">{email}</p>
          </div>
        </div>

        <form onSubmit={onLogin} className="space-y-3">
          <label className="text-sm font-semibold text-gray-800">Password</label>
          <input
            type="password"
            required
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
          />

          {errorMsg && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {errorMsg}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <div className="text-xs text-gray-600 mt-3 flex items-center justify-between">
          <a href="/auth/login" className="text-blue-700 underline">Back</a>
          <a href="/auth/reset" className="text-blue-700 underline">Forgot password?</a>
        </div>
      </div>
    </main>
  );
}
