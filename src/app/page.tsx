// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Always redirect homepage → /auth/login
  redirect("/auth/login");
}
