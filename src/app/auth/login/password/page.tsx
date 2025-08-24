// src/app/auth/login/password/page.tsx
import { Suspense } from "react";
import PasswordClient from "./password-client";

export default function PasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-600">Loading…</div>}>
      <PasswordClient />
    </Suspense>
  );
}
