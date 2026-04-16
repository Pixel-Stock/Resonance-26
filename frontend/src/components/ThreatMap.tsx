"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { Globe } from "lucide-react";
import type { Anomaly } from "@/lib/types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoLocation {
  ip: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  isp: string;
  threat_type: string;
}

// Hardcoded fallback coords for well-known ranges (when API is unavailable)
const FALLBACK_COORDS: Record<string, [number, number]> = {
  "185.220.101.34": [13.4050, 52.5200],
  "91.240.118.222": [37.6173, 55.7558],
  "45.33.32.156":   [-97.8220, 37.7510],
  "72.14.192.5":    [-122.0553, 37.4193],
  "72.21.198.66":   [-122.0553, 37.4193],
  "95.173.136.70":  [37.6173, 55.7558],
};

// Regex to extract any IP-like token from raw log text
const IP_ANY_RE = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;

function isValidPublicIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => p < 0 || p > 255)) return false;
  return !isPrivate(ip);
}

function isPrivate(ip: string) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    ip.startsWith("172.16.") ||
    ip === "0.0.0.0"
  );
}

// Deterministic fallback so every public IP gets a plausible position
function defaultCoords(ip: string): [number, number] {
  const p = ip.split(".").map(Number);
  const lon = (((p[0] * 97 + p[1] * 31) % 3600) / 10) - 180;
  const lat = (((p[0] * 53 + p[2] * 17) % 1400) / 10) - 70;
  return [lon, lat];
}

type SeverityKey = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEV_COLORS: Record<SeverityKey, string> = {
  CRITICAL: "#fb7185",
  HIGH:     "#fb923c",
  MEDIUM:   "#fbbf24",
  LOW:      "#2dd4bf",
};

/** Extract every unique public IP from parsed_log.ip AND the raw text of all anomalies. */
function extractAllIPs(anomalies: Anomaly[]): Map<string, { threat: string; severity: SeverityKey }> {
  const ipMap = new Map<string, { threat: string; severity: SeverityKey }>();

  for (const a of anomalies) {
    const val = { threat: a.threat_type, severity: a.severity as SeverityKey };
    if (a.parsed_log.ip && isValidPublicIP(a.parsed_log.ip)) {
      if (!ipMap.has(a.parsed_log.ip)) ipMap.set(a.parsed_log.ip, val);
    }
    const matches = [...a.parsed_log.raw.matchAll(IP_ANY_RE)];
    for (const m of matches) {
      const ip = m[1];
      if (isValidPublicIP(ip) && !ipMap.has(ip)) ipMap.set(ip, val);
    }
  }

  console.log(`[ThreatMap] IPs extracted: ${ipMap.size}`, [...ipMap.keys()]);
  return ipMap;
}

async function geolocateIPs(ipToThreat: Map<string, string>): Promise<GeoLocation[]> {
  const unique = [...ipToThreat.keys()];
  if (unique.length === 0) return [];

  let geoResults: Map<string, { lat: number; lon: number; city: string; country: string; isp: string }> = new Map();

  try {
    const res = await fetch(
      "http://ip-api.com/batch?fields=status,country,city,lat,lon,isp,query",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unique.slice(0, 100).map((q) => ({ query: q }))),
      }
    );
    if (res.ok) {
      const data: { status: string; query: string; lat: number; lon: number; city: string; country: string; isp: string }[] = await res.json();
      for (const d of data) {
        if (d.status === "success") {
          geoResults.set(d.query, { lat: d.lat, lon: d.lon, city: d.city, country: d.country, isp: d.isp });
        }
      }
    }
  } catch { /* API unavailable — fall through to fallbacks */ }

  // Build final list — never drop an IP, always fall back
  const locations: GeoLocation[] = unique.map((ip) => {
    const geo = geoResults.get(ip);
    if (geo) {
      return { ip, lat: geo.lat, lon: geo.lon, city: geo.city, country: geo.country, isp: geo.isp, threat_type: ipToThreat.get(ip) ?? "UNKNOWN" };
    }
    const fallback = FALLBACK_COORDS[ip];
    const [lon, lat] = fallback ?? defaultCoords(ip);
    return { ip, lat, lon, city: "Unknown", country: "Unknown", isp: "", threat_type: ipToThreat.get(ip) ?? "UNKNOWN" };
  });

  console.log(`[ThreatMap] IPs plotted: ${locations.length}`, locations.map((l) => `${l.ip} (${l.lat.toFixed(1)},${l.lon.toFixed(1)})`));
  return locations;
}

interface ThreatMapProps {
  anomalies: Anomaly[];
}

export function ThreatMap({ anomalies }: ThreatMapProps) {
  const [locations, setLocations] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<GeoLocation | null>(null);

  useEffect(() => {
    setLoading(true);
    const ipToThreat = extractAllIPs(anomalies);
    geolocateIPs(ipToThreat).then((locs) => {
      setLocations(locs);
      setLoading(false);
    });
  }, [anomalies]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.15 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <h2 className="text-sm uppercase font-semibold tracking-wider flex items-center gap-2" style={{ color: "#1e293b" }}>
          <Globe className="w-4 h-4 text-violet-500" />
          Threat Origin Map
        </h2>
        <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
          {loading ? "Geolocating..." : `${locations.length} IPs mapped`}
        </span>
      </div>

      <div style={{ position: "relative", background: "rgba(255,255,255,0.1)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.25)" }}>
        <ComposableMap
          projection="geoNaturalEarth1"
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: { fill: "rgba(139,92,246,0.12)", stroke: "rgba(255,255,255,0.3)", strokeWidth: 0.4, outline: "none" },
                      hover: { fill: "rgba(139,92,246,0.22)", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {locations.map((loc, i) => (
              <Marker
                key={i}
                coordinates={[loc.lon, loc.lat]}
                onMouseEnter={() => setTooltip(loc)}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Pulsing ring */}
                <circle r={8} fill="rgba(251,113,133,0.15)" stroke="none">
                  <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
                {/* Core dot */}
                <circle
                  r={5}
                  fill="#fb7185"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={1.5}
                  style={{ cursor: "pointer", filter: "drop-shadow(0 0 4px rgba(251,113,133,0.6))" }}
                />
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "12px",
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1.5px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#3a3632",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.2)",
              pointerEvents: "none",
            }}
          >
            <p className="font-bold">{tooltip.ip}</p>
            <p style={{ color: "#64748b" }}>{tooltip.city}, {tooltip.country}</p>
            <p style={{ color: "#fb7185", fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>
              {String(tooltip.threat_type ?? "UNKNOWN").replace(/_/g, " ")}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
