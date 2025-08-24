import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** Map density → weight for averaging. */
const WEIGHTS: Record<string, number> = { low: 1, med: 2, high: 3, critical: 4 };

function labelFromScore(avg: number) {
  if (avg >= 3.5) return "critical";
  if (avg >= 2.5) return "high";
  if (avg >= 1.6) return "med";
  return "low";
}

export async function GET(req: NextRequest) {
  const fsq_id = new URL(req.url).searchParams.get("fsq_id")?.trim();
  if (!fsq_id) return NextResponse.json({ error: "Missing fsq_id" }, { status: 400 });

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // last 2h
  const { data, error } = await supabase
    .from("reports")
    .select("density, created_at")
    .eq("fsq_id", fsq_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[density] query error:", error);
    return NextResponse.json({ level: "unknown", sample: 0 });
  }

  if (!data?.length) return NextResponse.json({ level: "unknown", sample: 0 });

  // time decay (newer reports weigh more)
  const now = Date.now();
  let total = 0, weightSum = 0;
  data.forEach((r) => {
    const w = WEIGHTS[r.density as keyof typeof WEIGHTS] ?? 0;
    const ageMin = Math.max(0, (now - new Date(r.created_at).getTime()) / 60000);
    const decay = Math.max(0.4, 1 - ageMin / 120); // 1→0.4 over 120min
    total += w * decay;
    weightSum += decay;
  });

  const avg = weightSum > 0 ? total / weightSum : 0;
  const level = labelFromScore(avg);
  return NextResponse.json({ level, sample: data.length });
}
