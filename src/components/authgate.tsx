// src/components/authgate.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session);

      // keep session in sync
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, session) => {
        setAuthed(!!session);
      });

      setLoading(false);

      return () => subscription.unsubscribe();
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!authed) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    return null;
  }

  return <>{children}</>;
}
