// src/app/map/page.tsx
"use client";

import AuthGate from "@/components/authgate";
import MapClient from "@/components/MapClient";

export default function MapPage() {
  return (
    <AuthGate>
      <MapClient />
    </AuthGate>
  );
}
