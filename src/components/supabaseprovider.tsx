"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";

type SessionContext = {
  session: import("@supabase/supabase-js").Session | null;
  user: import("@supabase/supabase-js").User | null;
  loading: boolean;
};

const Ctx = createContext<SessionContext>({
  session: null,
  user: null,
  loading: true,
});

export function useSession() {
  return useContext(Ctx);
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionContext["session"]>(null);
  const [user, setUser] = useState<SessionContext["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={{ session, user, loading }}>{children}</Ctx.Provider>;
}
