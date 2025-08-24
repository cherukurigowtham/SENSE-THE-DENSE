import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Body = {
  fsq_id?: string;
  density?: "low" | "med" | "high" | "critical";
  lat?: number;
  lng?: number;
  user_hash?: string;
  source?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    const fsq_id = (body.fsq_id || "").trim();
    const density = (body.density || "").trim() as Body["density"];
    const lat = Number.isFinite(body.lat) ? body.lat : null;
    const lng = Number.isFinite(body.lng) ? body.lng : null;
    const source = (body.source || "user").slice(0, 32);
    const user_hash = body.user_hash?.slice(0, 128) || null;

    if (!fsq_id) return NextResponse.json({ error: "Missing fsq_id" }, { status: 400 });
    if (!["low","med","high","critical"].includes(density || "")) {
      return NextResponse.json({ error: "Invalid density" }, { status: 400 });
    }

    // Optional: simple rate-limit by IP (best-effort)
    // const ip = req.headers.get("x-forwarded-for") || "local";
    // (Add a KV/redis check if you deploy; omitted for hackathon simplicity.)

    const { error } = await supabase.from("reports").insert({
      fsq_id, density, lat, lng, source, user_hash,
    } as any);

    if (error) {
      console.error("[report] insert error:", error);
      return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[report] exception:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
