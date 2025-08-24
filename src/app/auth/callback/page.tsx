"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Handles Google/GitHub OAuth and Magic Link / Recovery links
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (!error && data.session) {
        router.replace("/map");
        return;
      }
      const session = (await supabase.auth.getSession()).data.session;
      router.replace(session ? "/map" : "/auth/login");
    })();
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-white to-blue-50">
      <div className="text-sm text-gray-600">Signing you in…</div>
    </main>
  );
}
