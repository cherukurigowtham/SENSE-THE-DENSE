// src/app/api/foursquare/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import ngeohash from "ngeohash";
import { supabase } from "@/lib/supabase";

const FSQ_BASE = "https://places-api.foursquare.com/places/search";
// ✅ Accept either name; DO NOT put this in NEXT_PUBLIC_*
const FSQ_KEY = (process.env.FSQ_SERVICE_KEY || process.env.FOURSQUARE_SERVICE_KEY || "").trim();
const FSQ_VER = (process.env.FOURSQUARE_API_VERSION || "2025-06-17").trim();

function missingEnv(which: string) {
  console.error(`[FSQ] Missing env: ${which}. Set it in .env.local (server-side only).`);
  return NextResponse.json(
    { error: `Missing ${which}. Set it in .env.local (server-side only).` },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  if (!FSQ_KEY) return missingEnv("FSQ_SERVICE_KEY or FOURSQUARE_SERVICE_KEY");

  const { searchParams } = new URL(req.url);
  const ll = searchParams.get("ll");
  const radius = searchParams.get("radius") || "800";
  const categories = searchParams.get("categories") || "16032,19000,12000,18000";

  if (!ll) return NextResponse.json({ error: "Missing ll" }, { status: 400 });

  // ---- cache key
  let cacheKey = "";
  try {
    const [latStr, lngStr] = ll.split(",");
    cacheKey = `search:${ngeohash.encode(parseFloat(latStr), parseFloat(lngStr), 7)}:${radius}:${categories}`;
  } catch {
    cacheKey = `search:${ll}:${radius}:${categories}`;
  }

  const nowIso = new Date().toISOString();

  // 1) cache read (non-fatal on error)
  try {
    const { data: cached } = await supabase
      .from("fsq_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", nowIso)
      .maybeSingle();
    if (cached?.payload) return NextResponse.json(cached.payload);
  } catch (e) {
    console.warn("[fsq_cache] read skipped:", e);
  }

  // 2) call Foursquare
  try {
    const url = new URL(FSQ_BASE);
    url.searchParams.set("ll", ll);
    url.searchParams.set("radius", radius);
    url.searchParams.set("limit", "30");
    if (categories) url.searchParams.set("categories", categories);

    const r = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${FSQ_KEY}`,
        Accept: "application/json",
        "X-Places-Api-Version": FSQ_VER,
      },
      cache: "no-store",
      // @ts-ignore
      next: { revalidate: 0 },
    });

    const text = await r.text();
    let payload: any = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }

    if (!r.ok) {
      console.error("[Foursquare] error", r.status, payload || text);
      return NextResponse.json(
        { error: "Foursquare error", status: r.status, warning: payload?.message ?? text },
        { status: 502 }
      );
    }

    // normalize
    if (Array.isArray(payload?.results)) {
      payload.results = payload.results.map((p: any) => {
        const lat = p.latitude ?? p?.geocodes?.main?.latitude;
        const lng = p.longitude ?? p?.geocodes?.main?.longitude;
        return {
          ...p,
          fsq_id: p.fsq_place_id ?? p.fsq_id,
          geocodes: { main: { latitude: lat, longitude: lng } },
        };
      });
    }

    // 3) cache write (best-effort)
    try {
      await supabase.from("fsq_cache").upsert({
        cache_key: cacheKey,
        payload,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    } catch (e) {
      console.warn("[fsq_cache] write skipped:", e);
    }

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[Foursquare] fetch exception:", e?.message || e);
    return NextResponse.json(
      { error: "Foursquare fetch failed", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
