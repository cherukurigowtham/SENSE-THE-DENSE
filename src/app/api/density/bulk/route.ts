import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---- Tunables ----
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const WINDOW_RECENT_MIN = 30;   // “current” reports window
const STALE_CUTOFF_MIN  = 120;  // if no reports within this → treat as low/normal
const NEIGHBOR_METERS   = 250;  // neighborhood radius for averaging

type BulkPlace = { id: string; lat: number; lng: number };

// Haversine distance in meters
function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

// map level <-> score
const toScore: Record<string, number> = { low: 1, med: 2, medium: 2, high: 3, critical: 4 };
function scoreToLevel(avg: number): "low"|"med"|"high"|"critical" {
  const s = Math.max(1, Math.min(4, Math.round(avg)));
  return s === 1 ? "low" : s === 2 ? "med" : s === 3 ? "high" : "critical";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const places = (body?.places ?? []) as BulkPlace[];

    if (!Array.isArray(places) || places.length === 0) {
      return NextResponse.json({}, { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

    const now = Date.now();
    const recentSinceISO = new Date(now - WINDOW_RECENT_MIN * 60 * 1000).toISOString();
    const staleSinceISO  = new Date(now - STALE_CUTOFF_MIN  * 60 * 1000).toISOString();

    const ids = places.map(p => p.id);

    // 1) Pull RECENT reports (window = 30 min)
    const { data: recentRows, error: errRecent } = await supabase
      .from("reports")
      .select("fsq_id,density,created_at")
      .in("fsq_id", ids)
      .gt("created_at", recentSinceISO);

    if (errRecent) {
      console.error("[bulk density] recent error:", errRecent);
    }

    // 2) Pull STALE coverage (window = 120 min) to know if we should revert to low
    const { data: staleRows, error: errStale } = await supabase
      .from("reports")
      .select("fsq_id,created_at")
      .in("fsq_id", ids)
      .gt("created_at", staleSinceISO);

    if (errStale) {
      console.error("[bulk density] stale error:", errStale);
    }

    // 3) Aggregate RECENT counts per id
    const countsRecent: Record<string, Record<string, number>> = {};
    for (const r of recentRows ?? []) {
      const id = r.fsq_id as string;
      const lvl = String(r.density || "").toLowerCase();
      countsRecent[id] ??= {};
      countsRecent[id][lvl] = (countsRecent[id][lvl] ?? 0) + 1;
    }

    const sampleRecentById: Record<string, number> = {};
    const currentScoreById: Record<string, number | undefined> = {};
    for (const id of ids) {
      const c = countsRecent[id] || {};
      const sample = Object.values(c).reduce((a, b) => a + b, 0);
      sampleRecentById[id] = sample;

      if (sample === 0) {
        currentScoreById[id] = undefined; // no recent “current level”
      } else {
        // majority in recent window -> level -> score
        let best: string | null = null;
        let bestCount = -1;
        for (const k of Object.keys(c)) {
          const n = c[k] ?? 0;
          if (n > bestCount) { best = k; bestCount = n; }
        }
        const score = best ? (toScore[best] ?? undefined) : undefined;
        currentScoreById[id] = score;
      }
    }

    // 4) Build quick lookup for “has any report within 2h”
    const hasStaleWithin2h = new Set<string>();
    for (const r of staleRows ?? []) {
      hasStaleWithin2h.add(r.fsq_id as string);
    }

    // 5) Neighborhood averaging (use only places with currentScore)
    const resp: Record<string, { level: string; sample: number }> = {};
    for (const p of places) {
      const id = p.id;

      // Collect neighbors with current score
      const scores: number[] = [];
      for (const q of places) {
        const qScore = currentScoreById[q.id];
        if (qScore == null) continue;
        const d = distM(p.lat, p.lng, q.lat, q.lng);
        if (d <= NEIGHBOR_METERS) scores.push(qScore);
      }

      let finalLevel: "low" | "med" | "high" | "critical";

      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        finalLevel = scoreToLevel(avg);
      } else {
        // No recent signals around. If absolutely nothing within 2h → normalize to low.
        // (Between 30–120 min we also normalize to low to keep the app calm.)
        finalLevel = "low";
      }

      resp[id] = { level: finalLevel, sample: sampleRecentById[id] ?? 0 };
    }

    return NextResponse.json(resp);
  } catch (e) {
    console.error("[bulk density] exception:", e);
    return NextResponse.json({}, { status: 200 });
  }
}
