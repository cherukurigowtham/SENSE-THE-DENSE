// src/app/layout.tsx
import "./globals.css";
import SupabaseProvider from "@/components/supabaseprovider";

export const metadata = {
  title: "Sense the Dense",
  description: "Crowd density map",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
