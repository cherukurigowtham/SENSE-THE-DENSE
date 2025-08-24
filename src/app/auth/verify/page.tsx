"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OTPInputs from "@/components/auth/OTPInputs";
import { supabase } from "@/lib/supabase";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const e = sessionStorage.getItem("verify_email");
    if (!e) router.replace("/auth/login");
    else setEmail(e);
  }, [router]);

  const onVerify = async (code: string) => {
    if (!email) return;
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) return alert(error.message);
    if (data.session) {
      sessionStorage.removeItem("verify_email");
      router.replace("/map");
    } else {
      router.replace("/auth/callback");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-white to-blue-50 grid place-items-center">
      <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-xl shadow-xl p-6 w-[min(460px,92vw)]">
        <h1 className="text-xl font-extrabold text-gray-900">Enter the 6-digit code</h1>
        <p className="text-sm text-gray-600 mt-1">
          We sent a code to <span className="font-semibold">{email}</span>
        </p>
        <OTPInputs length={6} onComplete={onVerify} className="mt-5" />
        <div className="text-xs text-gray-600 mt-4">
          Wrong email? <a className="text-blue-700 underline" href="/auth/login">Go back</a>
        </div>
      </div>
    </main>
  );
}
