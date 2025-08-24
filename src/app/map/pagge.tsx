// src/app/map/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MapClient from "@/components/MapClient";

export default function MapPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/auth/login");
      } else {
        setReady(true);
      }
    })();
  }, [router]);

  if (!ready) return null; // or a spinner/skeleton if you want
  return <MapClient />;
}
