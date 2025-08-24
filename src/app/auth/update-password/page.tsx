"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // This page is visited via the recovery link -> a session is created.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      }
    })();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return alert(error.message);
    setOk(true);
    setTimeout(() => router.replace("/map"), 600);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50 grid place-items-center">
      <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 w-[min(460px,92vw)]">
        <h1 className="text-xl font-extrabold text-gray-900">Set a new password</h1>
        <form onSubmit={onSubmit} className="space-y-3 mt-4">
          <input
            type="password" required minLength={6}
            value={pwd} onChange={(e)=>setPwd(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-black/15 bg-white/90 text-black focus:outline-none focus:ring-2 focus:ring-blue-400/70"
          />
          <button className="w-full rounded-xl px-4 py-2.5 font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow hover:brightness-105 active:scale-[0.98]">
            Update password
          </button>
        </form>
        {ok && <p className="text-xs text-green-700 mt-3">Password updated. Redirecting…</p>}
      </div>
    </main>
  );
}
