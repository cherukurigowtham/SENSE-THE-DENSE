"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/update-password`,
    });
    if (error) return alert(error.message);
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50 grid place-items-center">
      <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 w-[min(460px,92vw)]">
        <h1 className="text-xl font-extrabold text-gray-900">Reset password</h1>
        <p className="text-sm text-gray-600 mt-1">We’ll email you a secure link.</p>
        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          <input
            type="email" required placeholder="you@example.com"
            value={email} onChange={(e)=>setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
          />
          <button className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98]">
            Send reset link
          </button>
        </form>
        {sent && <p className="text-xs text-green-700 mt-3">Check your email for the link.</p>}
      </div>
    </main>
  );
}
