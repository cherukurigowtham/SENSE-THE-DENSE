// src/components/MapClient.tsx
"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import type { Map as LeafletMap, DivIcon } from "leaflet";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

// react-leaflet (client only)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

/* =========================
   Domain Types / Constants
   ========================= */

type Theme = "light";

type GeoMain = { latitude: number; longitude: number };

type Place = {
  fsq_id: string;
  name?: string;
  geocodes?: { main?: GeoMain };
  latitude?: number;
  longitude?: number;
  location?: { formatted_address?: string };
  link?: string;
  distance?: number;
};

type DensityLevel = "low" | "med" | "high" | "critical" | "unknown";

type DensityEntry = {
  level: DensityLevel;
  sample: number;
  updated_at?: string;
};

type DensityMap = Record<string, DensityEntry>;

const DEFAULT_POS: [number, number] = [17.385044, 78.486671]; // Hyderabad

// categories (Transit removed)
const CAT_PRESETS: Array<{ id: string; label: string }> = [
  { id: "16032", label: "Parks" },
  { id: "12000", label: "Religious" },
  { id: "18000", label: "Stadiums" },
];

// few city presets (you can extend)
const PRESETS: Record<string, [number, number]> = {
  Hyderabad: [17.385044, 78.486671],
  Mumbai: [19.076, 72.8777],
  Bengaluru: [12.9716, 77.5946],
  Delhi: [28.6139, 77.209],
  Kolkata: [22.5726, 88.3639],
  Chennai: [13.0827, 80.2707],
  Pune: [18.5204, 73.8567],
  Ahmedabad: [23.0225, 72.5714],
};

// density → color (legend truth source)
const DENSITY_COLORS: Record<DensityLevel, string> = {
  low: "#00b341",
  med: "#c79100",
  high: "#e25b00",
  critical: "#e00047",
  unknown: "#0aa0e6",
};
const DENSITY_SIZE: Record<DensityLevel, number> = {
  low: 14,
  med: 16,
  high: 18,
  critical: 20,
  unknown: 14,
};
const DENSITY_PULSE_SEC: Record<DensityLevel, number> = {
  low: 1.8,
  med: 1.6,
  high: 1.4,
  critical: 1.2,
  unknown: 1.8,
};

const BASEMAPS = {
  light: {
    base:
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    labels:
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  },
};

/* =========================
   Utilities / Hooks
   ========================= */

function normalizeDensity(v: unknown): DensityLevel {
  if (typeof v !== "string") return "unknown";
  const s = v.trim().toLowerCase();
  if (s === "low") return "low";
  if (s === "medium" || s === "med" || s === "mid" || s === "moderate")
    return "med";
  if (s === "high") return "high";
  if (s === "critical" || s === "severe" || s === "very high" || s === "vh")
    return "critical";
  return "unknown";
}

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Toast = { id: number; text: string };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return { toasts, add };
}

// highlight ripple at target
function PingRipple({
  pos,
  color = "#06b6d4",
}: {
  pos: [number, number];
  color?: string;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      setT(elapsed);
      if (elapsed < 1200) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pos[0], pos[1]]);

  const ripple = (delay: number) => {
    const life = Math.max(0, Math.min(1, (t - delay) / 800));
    return {
      radius: 5 + life * 30,
      opacity: Math.max(0, 0.5 - life * 0.5),
    };
  };
  const r1 = ripple(0),
    r2 = ripple(200),
    r3 = ripple(400);

  return (
    <>
      {[r1, r2, r3].map((r, i) =>
        r.opacity > 0 ? (
          <CircleMarker
            key={i}
            center={pos}
            radius={r.radius}
            pathOptions={{
              color,
              opacity: r.opacity,
              fillColor: color,
              fillOpacity: r.opacity * 0.25,
              weight: 2,
            }}
          />
        ) : null
      )}
      <CircleMarker
        center={pos}
        radius={4}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1,
        }}
      />
    </>
  );
}

// legend with toggles
function MapLegend({
  visibleLevels,
  toggleLevel,
}: {
  visibleLevels: Set<DensityLevel>;
  toggleLevel: (lvl: DensityLevel) => void;
}) {
  const items: Array<{ label: string; key: DensityLevel }> = [
    { label: "Low", key: "low" },
    { label: "Medium", key: "med" },
    { label: "High", key: "high" },
    { label: "Critical", key: "critical" },
    { label: "Unknown", key: "unknown" },
  ];
  return (
    <div className="absolute left-4 bottom-4 z-[1000] rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md bg-white/80 border border-black/15 text-black">
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-2">
        Legend
      </div>
      <ul className="space-y-1">
        {items.map(({ label, key }) => {
          const on = visibleLevels.has(key);
          return (
            <li
              key={key}
              onClick={() => toggleLevel(key)}
              className={`flex items-center gap-2 cursor-pointer select-none ${
                on ? "" : "opacity-40"
              }`}
              title={on ? "Click to hide" : "Click to show"}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: DENSITY_COLORS[key],
                  boxShadow: `0 0 6px ${DENSITY_COLORS[key]}`,
                }}
              />
              <span className="text-xs">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// tiny chip
function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border shrink-0",
        active
          ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0"
          : "bg-white/70 text-black border-black/20 hover:bg-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <button
      {...rest}
      className={[
        "relative inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-sm font-bold shrink-0",
        "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border border-black/10",
        "shadow-[0_10px_20px_-10px_rgba(59,130,246,0.8)]",
        "hover:brightness-[1.06] active:scale-[0.98] transition-all",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function FrostInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        "px-2 py-1.5 rounded-xl text-xs shrink-0",
        "backdrop-blur-md bg-white/90 text-black border border-black/20 placeholder-gray-500",
        "focus:ring-2 focus:ring-blue-400/70",
        className,
      ].join(" ")}
    />
  );
}

function FrostSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  const style: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.95)",
    color: "#000",
  };
  return (
    <select
      {...rest}
      style={style}
      className={[
        "px-3 py-1.5 rounded-xl text-xs border border-black/20 shadow-sm hover:shadow transition focus:outline-none focus:ring-2 focus:ring-blue-400/70",
        className,
      ].join(" ")}
    >
      {children}
    </select>
  );
}

// neon icons — strongly typed
function useNeonIcons() {
  const [icons, setIcons] = useState<Record<DensityLevel, DivIcon> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const Leaflet = await import("leaflet");
      const L =
        Leaflet.default ||
        ((Leaflet as unknown) as typeof import("leaflet"));
      const reduceMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

      const make = (level: DensityLevel): DivIcon => {
        const color = DENSITY_COLORS[level] ?? DENSITY_COLORS.unknown;
        const size = DENSITY_SIZE[level] ?? 14;
        const dur = reduceMotion ? 1000 : DENSITY_PULSE_SEC[level] ?? 1.8;
        const html = `<div class="std-neon-marker" style="--c:${color}; --size:${size}px; --dur:${dur}s;"><span class="dot"></span>${
          reduceMotion ? "" : '<span class="pulse"></span>'
        }</div>`;
        return L.divIcon({
          className: "std-neon-icon",
          html,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      };

      const built: Record<DensityLevel, DivIcon> = {
        low: make("low"),
        med: make("med"),
        high: make("high"),
        critical: make("critical"),
        unknown: make("unknown"),
      };
      if (!cancelled) setIcons(built);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return icons;
}

/* ================
   Report Panel
   ================ */

function ReportPanel(props: {
  open: boolean;
  onClose: () => void;
  places: Place[];
  reportPlaceId: string;
  setReportPlaceId: (v: string) => void;
  reportDensity: DensityLevel extends "unknown" ? never : "low" | "med" | "high" | "critical";
  setReportDensity: (v: "low" | "med" | "high" | "critical") => void;
  submit: () => void;
  submitting: boolean;
}) {
  const {
    open,
    onClose,
    places,
    reportPlaceId,
    setReportPlaceId,
    reportDensity,
    setReportDensity,
    submit,
    submitting,
  } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <button
          aria-label="Close report panel"
          onClick={onClose}
          className="fixed inset-0 z-[1100] bg-black/30 backdrop-blur-[2px]"
        />
      )}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className={[
          "fixed top-0 right-0 h-full w-[min(420px,92vw)] z-[1110] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="h-full flex flex-col bg-white/95 border-l border-black/10 text-black">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
            <div
              className="text-sm font-bold uppercase tracking-wide"
              id="report-title"
            >
              Report
            </div>
            <button
              onClick={onClose}
              className="px-2 py-1 rounded-lg text-xs bg-white border border-black/20 hover:bg-gray-50"
              aria-label="Close"
              title="Close"
            >
              Close
            </button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-black/70">
                Nearby place
              </label>
              <FrostSelect
                value={reportPlaceId}
                onChange={(e) => setReportPlaceId(e.target.value)}
                aria-label="Nearby place to tag"
                className="w-full"
              >
                {places.slice(0, 60).map((p) => (
                  <option key={p.fsq_id} value={p.fsq_id}>
                    {p.name ?? "Unknown"}{" "}
                    {p.distance != null ? `(${p.distance}m)` : ""}
                  </option>
                ))}
                {!places.length && <option value="">(no places in view)</option>}
              </FrostSelect>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-black/70">
                Density
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["low", "med", "high", "critical"] as const).map((lvl) => (
                  <label
                    key={lvl}
                    className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer select-none bg-white/80 border-black/15"
                  >
                    <span className="capitalize text-sm">{lvl}</span>
                    <input
                      type="radio"
                      name="density"
                      value={lvl}
                      checked={reportDensity === lvl}
                      onChange={() => setReportDensity(lvl)}
                    />
                    <span
                      className="inline-block w-3 h-3 rounded-full ml-1"
                      style={{ backgroundColor: DENSITY_COLORS[lvl] }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <GButton
              onClick={submit}
              disabled={submitting || !reportPlaceId}
              className="w-full disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </GButton>

            <p className="text-[11px] text-black/60">
              Client-side insert with RLS (trigger fills <code>user_id</code>).
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ================
   Main Component
   ================ */

export default function MapClient() {
  const { toasts, add: addToast } = useToasts();

  const [pos, setPos] = useState<[number, number]>(DEFAULT_POS);
  const [places, setPlaces] = useState<Place[]>([]);
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activeCats, setActiveCats] = useState<string[]>(
    CAT_PRESETS.map((c) => c.id)
  );
  const [densities, setDensities] = useState<DensityMap>({});
  const [pingPos, setPingPos] = useState<[number, number] | null>(null);
  const [locInput, setLocInput] = useState("");
  const [agentOn, setAgentOn] = useState(false);

  // legend visibility
  const [visibleLevels, setVisibleLevels] = useState<Set<DensityLevel>>(
    new Set(["low", "med", "high", "critical", "unknown"])
  );
  const toggleLevel = (lvl: DensityLevel) =>
    setVisibleLevels((s) => {
      const n = new Set(s);
      n.has(lvl) ? n.delete(lvl) : n.add(lvl);
      if (typeof window !== "undefined")
        localStorage.setItem("visibleLevels", JSON.stringify(Array.from(n)));
      return n;
    });

  // report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPlaceId, setReportPlaceId] = useState<string>("");
  const [reportDensity, setReportDensity] =
    useState<"low" | "med" | "high" | "critical">("med");
  const [reportSending, setReportSending] = useState(false);
  const lastReportRef = useRef<number>(0);

  // auth session (to show signout)
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setHasSession(!!s)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const neonIcons = useNeonIcons();
  const mapRef: RefObject<LeafletMap | null> = useRef<LeafletMap | null>(null);
  const triedGeoRef = useRef(false);

  // restore from URL hash / localStorage
  useEffect(() => {
    try {
      const hash =
        typeof window !== "undefined" ? window.location.hash.slice(1) : "";
      if (hash) {
        const p = new URLSearchParams(hash);
        const lat = parseFloat(p.get("lat") || "");
        const lng = parseFloat(p.get("lng") || "");
        const rkm = parseFloat(p.get("r") || "");
        if (Number.isFinite(lat) && Number.isFinite(lng)) setPos([lat, lng]);
        if (Number.isFinite(rkm) && rkm >= 1 && rkm <= 3) setRadiusKm(rkm);
      } else {
        const saved =
          typeof window !== "undefined"
            ? localStorage.getItem("mapState")
            : null;
        if (saved) {
          const s = JSON.parse(saved) as {
            pos?: [number, number];
            radiusKm?: number;
            activeCats?: string[];
          };
          if (Array.isArray(s.pos) && s.pos.length === 2)
            setPos([s.pos[0], s.pos[1]]);
          if (Number.isFinite(s.radiusKm) && s.radiusKm && s.radiusKm >= 1 && s.radiusKm <= 3)
            setRadiusKm(s.radiusKm);
          if (Array.isArray(s.activeCats)) setActiveCats(s.activeCats);
        }
      }
      const vis =
        typeof window !== "undefined"
          ? localStorage.getItem("visibleLevels")
          : null;
      if (vis) setVisibleLevels(new Set(JSON.parse(vis) as DensityLevel[]));
    } catch {
      // ignore
    }
  }, []);

  // persist to url/localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      params.set("lat", String(pos[0].toFixed(5)));
      params.set("lng", String(pos[1].toFixed(5)));
      params.set("r", String(radiusKm));
      if (typeof window !== "undefined")
        window.location.hash = params.toString();
      if (typeof window !== "undefined")
        localStorage.setItem(
          "mapState",
          JSON.stringify({ pos, radiusKm, activeCats })
        );
    } catch {
      // ignore
    }
  }, [pos, radiusKm, activeCats]);

  // smooth fly
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.flyTo(pos, 15, { duration: 0.9, easeLinearity: 0.25 });
  }, [pos]);

  // auto locate once
  useEffect(() => {
    if (triedGeoRef.current) return;
    triedGeoRef.current = true;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (res) => {
        const next: [number, number] = [
          res.coords.latitude,
          res.coords.longitude,
        ];
        setPos(next);
        setPingPos(next);
        setLocating(false);
        try {
          if (navigator.vibrate) navigator.vibrate(15);
        } catch {
          // ignore
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // debounced keys for fetching
  const posDeb = useDebounced(pos, 350);
  const radiusDeb = useDebounced(radiusKm, 350);
  const catsDeb = useDebounced(activeCats, 350);

  // fetch places
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      setWarning(null);
      try {
        const cats = catsDeb.join(",");
        const radius = Math.round(Math.max(0.1, radiusDeb) * 1000);
        const url = `/api/foursquare/search?ll=${posDeb[0]},${posDeb[1]}&radius=${radius}&categories=${encodeURIComponent(
          cats
        )}`;
        const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        const raw: unknown = await r.json();
        if (!r.ok) {
          const msg =
            typeof raw === "object" &&
            raw !== null &&
            "error" in raw &&
            typeof (raw as { error?: string }).error === "string"
              ? (raw as { error: string }).error
              : "Failed to load places.";
          throw new Error(msg);
        }
        const results = (raw as { results?: Place[] }).results ?? [];
        results.sort(
          (a, b) => (a.distance ?? 9e9) - (b.distance ?? 9e9)
        );
        setPlaces(results);
        setReportPlaceId(results[0]?.fsq_id ?? "");
      } catch (e) {
        const err = e as Error;
        if (err.name !== "AbortError") {
          setWarning(err.message || "Network error.");
          setPlaces([]);
          setDensities({});
          setReportPlaceId("");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [posDeb, radiusDeb, catsDeb]);

  // bulk densities
  useEffect(() => {
    let cancelled = false;
    const ids = places.map((p) => p.fsq_id).filter(Boolean);
    if (!ids.length) {
      setDensities({});
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/density/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const d: unknown = await r.json();
        if (!cancelled && typeof d === "object" && d !== null) {
          // assume server returns { [fsq_id]: { level, sample, updated_at? } }
          const map = d as Record<
            string,
            { level?: string; sample?: number; updated_at?: string }
          >;
          const norm: DensityMap = {};
          for (const [id, val] of Object.entries(map)) {
            norm[id] = {
              level: normalizeDensity(val.level),
              sample: typeof val.sample === "number" ? val.sample : 0,
              updated_at: val.updated_at,
            };
          }
          setDensities(norm);
        }
      } catch {
        if (!cancelled) setDensities({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [places]);

  // realtime updates -> refresh one id
  useEffect(() => {
    const ch = supabase
      .channel("realtime:reports-map")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        (payload: RealtimePostgresInsertPayload<{ fsq_id: string }>) => {
          const id = payload?.new?.fsq_id;
          if (!id || !places.some((p) => p.fsq_id === id)) return;
          (async () => {
            try {
              const r = await fetch(
                `/api/density?fsq_id=${encodeURIComponent(id)}`,
                { cache: "no-store" }
              );
              const d = (await r.json()) as {
                level?: string;
                sample?: number;
              };
              setDensities((prev) => ({
                ...prev,
                [id]: {
                  level: normalizeDensity(d?.level),
                  sample: d?.sample ?? 0,
                  updated_at: new Date().toISOString(),
                },
              }));
            } catch {
              // ignore
            }
          })();
        }
      );
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [places]);

  const toggleCat = (id: string) =>
    setActiveCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // derive hottest target (fixes complex deps warning)
  const hottest = useMemo(() => {
    const order: DensityLevel[] = ["critical", "high", "med", "low", "unknown"];
    const scored = places.map((p) => ({
      name: p.name ?? "a nearby spot",
      lvl: normalizeDensity(densities[p.fsq_id]?.level),
    }));
    scored.sort(
      (a, b) => order.indexOf(a.lvl) - order.indexOf(b.lvl)
    );
    return scored[0] ?? null;
  }, [places, densities]);

  // AGENT: ambient hint loop
  useEffect(() => {
    if (!agentOn || !hottest) return;
    let stop = false;
    const loop = async () => {
      while (!stop) {
        addToast(`Agent: head towards ${hottest.name} (${hottest.lvl})`);
        await new Promise((r) => setTimeout(r, 20000));
      }
    };
    void loop();
    return () => {
      stop = true;
    };
  }, [agentOn, hottest, addToast]);

  // sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    addToast("Signed out");
  };

  // location search (city or lat,lng)
  const goToLocation = () => {
    const raw = locInput.trim();
    if (!raw) return;

    const m = raw.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
    );
    if (m) {
      const la = Number(m[1]),
        ln = Number(m[2]);
      if (
        Number.isFinite(la) &&
        Number.isFinite(ln) &&
        Math.abs(la) <= 90 &&
        Math.abs(ln) <= 180
      ) {
        const next: [number, number] = [la, ln];
        setPos(next);
        setPingPos(next);
        return;
      }
    }
    const entries = Object.entries(PRESETS);
    const exact = entries.find(
      ([name]) => name.toLowerCase() === raw.toLowerCase()
    );
    if (exact) {
      setPos(exact[1]);
      setPingPos(exact[1]);
      return;
    }
    const fuzzy = entries.find(([name]) =>
      name.toLowerCase().includes(raw.toLowerCase())
    );
    if (fuzzy) {
      setPos(fuzzy[1]);
      setPingPos(fuzzy[1]);
      return;
    }
    addToast('Try a city (e.g., "Hyderabad") or lat,lng like 17.38,78.48');
  };

  const centerUser = () => {
    if (!("geolocation" in navigator)) {
      addToast("Geolocation not supported.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (res) => {
        const next: [number, number] = [
          res.coords.latitude,
          res.coords.longitude,
        ];
        setPos(next);
        setPingPos(next);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // CLIENT-SIDE report insert
  const submitCommunityReport = async () => {
    const now = Date.now();
    if (now - lastReportRef.current < 60000) {
      addToast("Please wait before sending another report.");
      return;
    }
    if (!reportPlaceId) {
      addToast("Select a place to tag your report.");
      return;
    }

    // optimistic
    setDensities((prev) => {
      const cur = prev[reportPlaceId];
      const nextSample = (cur?.sample ?? 0) + 1;
      return {
        ...prev,
        [reportPlaceId]: {
          level: reportDensity,
          sample: nextSample,
          updated_at: new Date().toISOString(),
        },
      };
    });

    try {
      setReportSending(true);
      const { error } = await supabase
        .from("reports")
        .insert({ fsq_id: reportPlaceId, density: reportDensity });
      if (error) throw error;
      addToast("Thanks! Your report is live.");
      setReportOpen(false);
      lastReportRef.current = now;
    } catch (e) {
      const err = e as Error;
      addToast(err.message || "Failed to send report.");
    } finally {
      setReportSending(false);
    }
  };

  const base = BASEMAPS.light;

  const presetHint = useMemo(() => {
    const q = locInput.trim().toLowerCase();
    if (!q) return "";
    const exact = Object.keys(PRESETS).find((n) => n.toLowerCase() === q);
    if (exact) return exact;
    const fuzzy = Object.keys(PRESETS).find((n) =>
      n.toLowerCase().includes(q)
    );
    return fuzzy || "";
  }, [locInput]);

  return (
    <div className="h-screen w-screen relative bg-white">
      {/* global CSS */}
      <style jsx global>{`
        .std-neon-icon {
          pointer-events: auto;
        }
        .std-neon-marker {
          position: relative;
          width: var(--size);
          height: var(--size);
          transform: translateZ(0);
        }
        .std-neon-marker .dot {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: var(--c);
          box-shadow: 0 0 10px var(--c), 0 0 20px var(--c),
            0 0 28px color-mix(in oklab, var(--c) 70%, black);
          outline: 1px solid rgba(255, 255, 255, 0.7);
        }
        .std-neon-marker .pulse {
          position: absolute;
          left: 50%;
          top: 50%;
          width: var(--size);
          height: var(--size);
          border-radius: 9999px;
          transform: translate(-50%, -50%);
          border: 2px solid color-mix(in oklab, var(--c) 85%, white 15%);
          opacity: 0.85;
          animation: stdPulse var(--dur) ease-out infinite;
          box-shadow: 0 0 8px color-mix(in oklab, var(--c) 70%, black);
        }
        @keyframes stdPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.55);
            opacity: 0.9;
          }
          60% {
            transform: translate(-50%, -50%) scale(2.1);
            opacity: 0;
          }
          100% {
            opacity: 0;
          }
        }

        .leaflet-container {
          font-family: ui-sans-serif, system-ui, Inter, Segoe UI, Roboto,
            Helvetica, Arial;
          font-size: 13px;
          color: #0b1320;
          background: #fff;
        }
        .leaflet-control {
          border-radius: 10px !important;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.9) !important;
          color: #000 !important;
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
        }
        .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.95);
          color: #0b1320;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 14px;
          backdrop-filter: blur(4px);
        }
        .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(0, 0, 0, 0.15);
        }
        .leaflet-container a {
          color: #1d4ed8;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Toasts */}
      <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-[1200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto px-3 py-2 rounded-lg bg-black/80 text-white text-sm shadow"
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* TOP BAR */}
      <div className="absolute z-[1000] left-1/2 -translate-x-1/2 mt-4 w-[98vw] max-w-[1200px]">
        <div className="rounded-xl backdrop-blur-md shadow-md bg-white/90 border border-black/15 text-black h-12 flex items-center">
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap overflow-x-auto no-scrollbar px-2 w-full">
            {/* location input */}
            <div className="relative shrink-0">
              <FrostInput
                value={locInput}
                onChange={(e) => setLocInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") goToLocation();
                }}
                placeholder='Location (e.g., "Hyderabad" or "17.38,78.48")'
                aria-label="Location"
                className="w-[260px] text-xs"
              />
              {presetHint && (
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-black/50">
                  {presetHint}
                </div>
              )}
            </div>

            <GButton
              onClick={goToLocation}
              aria-label="Go to typed location"
              className="px-3 py-1.5 shrink-0"
              title="Go"
            >
              Go
            </GButton>

            {/* radius dropdown (white bg / black text) */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-black/70">Radius</span>
              <FrostSelect
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                aria-label="Preset radius in kilometers"
                title="Radius"
              >
                <option value={1}>1 km</option>
                <option value={2}>2 km</option>
                <option value={3}>3 km</option>
              </FrostSelect>
            </div>

            {/* categories */}
            <div className="flex items-center gap-1 shrink-0">
              {CAT_PRESETS.map((c) => (
                <Chip
                  key={c.id}
                  active={activeCats.includes(c.id)}
                  onClick={() => toggleCat(c.id)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>

            {/* status: skeleton bar when loading */}
            {locating && (
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-blue-100 text-blue-700">
                Locating…
              </span>
            )}
            {loading && (
              <span
                className="inline-block h-2 w-24 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse shrink-0"
                aria-label="Loading"
              />
            )}
            {warning && !loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-yellow-100 text-yellow-800">
                ⚠ {warning}
              </span>
            )}

            {/* right tools */}
            <div className="ml-auto flex items-center gap-2 pr-1">
              {/* Agent mode icon toggle (OFF: blue, ON: violet) */}
              <button
                title={`Agent mode ${agentOn ? "ON" : "OFF"}`}
                aria-label="Toggle agent mode"
                onClick={() => setAgentOn((v) => !v)}
                className={[
                  "w-9 h-9 rounded-full border flex items-center justify-center shadow-sm",
                  agentOn
                    ? "bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white border-transparent"
                    : "bg-white text-blue-600 border-blue-200 hover:bg-blue-50",
                ].join(" ")}
              >
                {/* robot icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="currentColor"
                >
                  <path d="M12 2a1 1 0 0 1 1 1v1.06A7.002 7.002 0 0 1 19 11v4a3 3 0 0 1-3 3h-1a2 2 0 1 1-4 0H10a3 3 0 0 1-3-3v-4a7.002 7.002 0 0 1 6-6.94V3a1 1 0 0 1 1-1Zm-3 9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Z" />
                </svg>
              </button>

              {/* center on me */}
              <button
                onClick={centerUser}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-black/15 text-blue-600 shadow-sm hover:shadow active:scale-95 transition"
                aria-label="Center on my location"
                title="Center on me"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  fill="none"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364-6.364l-2.121 2.121M8.757 15.243l-2.121 2.121M15.243 15.243l2.121 2.121M8.757 8.757 6.636 6.636"
                  />
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>

              {/* sign out (only if logged in) */}
              {hasSession && (
                <button
                  onClick={signOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="w-9 h-9 rounded-full bg-white border border-black/15 text-rose-600 shadow-sm hover:bg-rose-50"
                >
                  {/* door-arrow icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 mx-auto"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M10 3a1 1 0 0 0-1 1v3h2V5h8v14h-8v-2H9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H10z" />
                    <path d="M13 12a1 1 0 0 0-1-1H5.414l1.293-1.293A1 1 0 0 0 5.293 8.293l-3 3a1 1 0 0 0 0 1.414l3 3a1 1 0 1 0 1.414-1.414L5.414 13H12a1 1 0 0 0 1-1z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <MapLegend visibleLevels={visibleLevels} toggleLevel={toggleLevel} />

      {/* Map */}
      <MapContainer
        ref={mapRef as unknown as RefObject<LeafletMap>}
        center={pos}
        zoom={15}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={base.base}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />
        <TileLayer url={base.labels} subdomains={["a", "b", "c", "d"]} />
        {pingPos && <PingRipple pos={pingPos} />}

        {places.map((p) => {
          const lat = p.geocodes?.main?.latitude ?? p.latitude;
          const lng = p.geocodes?.main?.longitude ?? p.longitude;
          if (!lat || !lng) return null;

          const id = p.fsq_id;
          const level = normalizeDensity(densities[id]?.level);
          if (!visibleLevels.has(level)) return null; // legend filter
          const sample = densities[id]?.sample ?? 0;
          const color = DENSITY_COLORS[level];

          const auraRadius =
            level === "critical"
              ? 22
              : level === "high"
              ? 18
              : level === "med"
              ? 14
              : 10;

          // Fallback circle while divIcon building
          if (!neonIcons) {
            return (
              <Fragment key={id}>
                <CircleMarker
                  key={`${id}-aura`}
                  center={[lat, lng]}
                  radius={auraRadius}
                  pathOptions={{
                    color,
                    weight: 2,
                    opacity: 0.9,
                    fillColor: color,
                    fillOpacity: 0.15,
                  }}
                />
                <CircleMarker
                  key={id}
                  center={[lat, lng]}
                  radius={6}
                  pathOptions={{
                    color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <PopupBody p={p} dens={level} sample={sample} />
                  </Popup>
                </CircleMarker>
              </Fragment>
            );
          }

          const icon: DivIcon = (neonIcons[level] ?? neonIcons.unknown)!;

          return (
            <Fragment key={id}>
              <CircleMarker
                key={`${id}-aura`}
                center={[lat, lng]}
                radius={auraRadius}
                pathOptions={{
                  color,
                  weight: 2,
                  opacity: 0.9,
                  fillColor: color,
                  fillOpacity: 0.15,
                }}
              />
              <Marker position={[lat, lng]} icon={icon} title={p.name ?? ""}>
                <Popup>
                  <PopupBody p={p} dens={level} sample={sample} />
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>

      {/* Report button */}
      <div className="absolute right-4 bottom-4 z-[1000]">
        <GButton onClick={() => setReportOpen(true)} aria-label="Open report panel">
          Report
        </GButton>
      </div>

      {/* Report panel */}
      <ReportPanel
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        places={places}
        reportPlaceId={reportPlaceId}
        setReportPlaceId={setReportPlaceId}
        reportDensity={reportDensity}
        setReportDensity={setReportDensity}
        submit={submitCommunityReport}
        submitting={reportSending}
      />
    </div>
  );
}

/* ================
   Popup Body
   ================ */

function PopupBody({
  p,
  dens,
  sample,
}: {
  p: Place;
  dens: DensityLevel;
  sample: number;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-black">
        {p.name ?? "Unknown place"}
      </div>
      {p.location?.formatted_address && (
        <div className="text-[11px] text-gray-600">
          {p.location.formatted_address}
        </div>
      )}
      <div className="text-xs text-black">
        Density:{" "}
        <span
          className="px-2 py-0.5 rounded-full font-extrabold text-white shadow-md"
          style={{ backgroundColor: DENSITY_COLORS[dens] }}
        >
          {dens}
        </span>{" "}
        <small className="text-gray-600">({sample})</small>
      </div>
      {typeof p.link === "string" && p.link.startsWith("/") && (
        <div className="text-xs">
          <a
            href={`https://foursquare.com${p.link}`}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-700"
          >
            View on Foursquare
          </a>
        </div>
      )}
    </div>
  );
}
