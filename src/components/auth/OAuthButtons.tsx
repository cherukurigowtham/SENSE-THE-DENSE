"use client";
import { supabase } from "@/lib/supabase";

export default function OAuthButtons() {
  const go = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/map` },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => go("google")}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-black/10 bg-white hover:bg-gray-50 transition font-semibold"
      >
        <GoogleIcon />
        Continue with Google
      </button>
      <button
        onClick={() => go("github")}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-black/10 bg-white hover:bg-gray-50 transition font-semibold"
      >
        <GitHubIcon />
        Continue with GitHub
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.837 32.91 29.272 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.152 7.961 3.039l5.657-5.657C33.64 6.053 28.997 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.391 16.135 18.855 12 24 12c3.059 0 5.842 1.152 7.961 3.039l5.657-5.657C33.64 6.053 28.997 4 24 4c-7.771 0-14.426 4.416-17.694 10.691z"/>
      <path fill="#4CAF50" d="M24 44c5.186 0 9.86-1.986 13.4-5.217l-6.181-5.236C29.18 35.465 26.727 36 24 36c-5.248 0-9.8-3.113-11.772-7.59l-6.54 5.036C8.93 39.51 15.906 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-1.09 2.861-3.155 5.088-5.885 6.547l.004-.003 6.181 5.236C37.26 40.502 44 36 44 24c0-1.341-.138-2.651-.389-3.917z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0a12 12 0 00-3.793 23.4c.6.111.82-.261.82-.58 0-.287-.01-1.047-.016-2.054-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.334-1.756-1.334-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.238 1.84 1.238 1.072 1.836 2.813 1.306 3.497.998.108-.776.42-1.306.763-1.606-2.665-.303-5.466-1.333-5.466-5.933 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.522.117-3.172 0 0 1.008-.322 3.301 1.23a11.51 11.51 0 016.005 0c2.292-1.552 3.299-1.23 3.299-1.23.655 1.65.243 2.869.12 3.172.77.84 1.235 1.911 1.235 3.221 0 4.61-2.805 5.628-5.479 5.924.431.372.816 1.102.816 2.222 0 1.606-.015 2.902-.015 3.296 0 .321.216.695.825.577A12 12 0 0012 0z"/>
    </svg>
  );
}
