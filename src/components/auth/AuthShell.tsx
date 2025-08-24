"use client";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function AuthShell({
  title,
  subtitle,
  children,
  logoSrc = "/logo.png",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  logoSrc?: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-white to-white text-black">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(1200px,92vw)] h-56 bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-fuchsia-500/15 blur-3xl rounded-full" />
      </div>

      <header className="pt-10 flex justify-center">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoSrc} alt="Sense the Dense" width={40} height={40} className="rounded-xl shadow" />
          <span className="text-2xl font-extrabold tracking-tight">Sense the Dense</span>
        </Link>
      </header>

      <main className="mx-auto mt-8 w-[min(960px,92vw)] grid md:grid-cols-2 gap-6 items-stretch">
        <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-md shadow-[0_30px_80px_-40px_rgba(0,0,0,0.3)] p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-black/70 mt-1">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>

        <div className="hidden md:flex rounded-2xl border border-black/10 bg-white/60 backdrop-blur-md shadow-inner p-0 overflow-hidden">
          <div className="w-full h-full relative">
            {/* Optional: replace preview image */}
            <Image src="/map-preview-light.jpg" alt="preview" fill className="object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/70 via-transparent to-white/30" />
            <div className="absolute bottom-4 left-4 text-black/80 text-sm font-semibold">
              Explore live crowd density — parks, stadiums, and more.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
