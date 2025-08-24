"use client";
export default function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm">
      {message}
    </div>
  );
}
