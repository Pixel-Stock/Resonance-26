"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Globe } from "lucide-react";
import type { Anomaly } from "@/lib/types";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoLocation {
  ip: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  isp: string;
  threat_type: string;
}

const FALLBACK_COORDS: Record<string, [number, number]> = {
  "185.220.101.34": [13.405, 52.52],
  "91.240.118.222": [37.6173, 55.7558],
  "45.33.32.156": [-97.822, 37.751],
  "72.14.192.5": [-122.0553, 37.4193],
  "72.21.198.66": [-122.0553, 37.4193],
  "95.173.136.70": [37.6173, 55.7558],
};

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

function defaultCoords(ip: string): [number, number] {
  const p = ip.split(".").map(Number);
  const lon = (((p[0] * 97 + p[1] * 31) % 3600) / 10) - 180;
  const lat = (((p[0] * 53 + p[2] * 17) % 1400) / 10) - 70;
  return [lon, lat];
}

type SeverityKey = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEV_COLORS: Record<SeverityKey, string> = {
  CRITICAL: "#fb7185",
  HIGH: "#fb923c",
  MEDIUM: "#fbbf24",
  LOW: "#2dd4bf",
};

function extractAllIPs(
  anomalies: Anomaly[]
): Map<string, { threat: string; severity: SeverityKey }> {
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
  return ipMap;
}

async function geolocateIPs(
  ipToThreat: Map<string, string>
): Promise<GeoLocation[]> {
  const unique = [...ipToThreat.keys()];
  if (unique.length === 0) return [];

  const geoResults = new Map<
    string,
    { lat: number; lon: number; city: string; country: string; isp: string }
  >();

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
      const data: {
        status: string;
        query: string;
        lat: number;
        lon: number;
        city: string;
        country: string;
        isp: string;
      }[] = await res.json();
      for (const d of data) {
        if (d.status === "success") {
          geoResults.set(d.query, {
            lat: d.lat,
            lon: d.lon,
            city: d.city,
            country: d.country,
            isp: d.isp,
          });
        }
      }
    }
  } catch { /* API unavailable — fall through */ }

  return unique.map((ip) => {
    const geo = geoResults.get(ip);
    if (geo) {
      return {
        ip,
        lat: geo.lat,
        lon: geo.lon,
        city: geo.city,
        country: geo.country,
        isp: geo.isp,
        threat_type: ipToThreat.get(ip) ?? "UNKNOWN",
      };
    }
    const fallback = FALLBACK_COORDS[ip];
    const [lon, lat] = fallback ?? defaultCoords(ip);
    return {
      ip,
      lat,
      lon,
      city: "Unknown",
      country: "Unknown",
      isp: "",
      threat_type: ipToThreat.get(ip) ?? "UNKNOWN",
    };
  });
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
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 22,
        delay: 0.15,
      }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div
        className="flex items-center justify-between pb-3 mb-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <h2
          className="text-sm uppercase font-semibold tracking-wider flex items-center gap-2"
          style={{ color: "#e2e8f0" }}
        >
          <Globe className="w-4 h-4" style={{ color: "#818cf8" }} />
          Threat Origin Map
        </h2>
        <span className="text-xs font-mono" style={{ color: "#64748b" }}>
          {loading ? "Geolocating..." : `${locations.length} IPs mapped`}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          background: "rgba(15,23,42,0.6)",
          borderRadius: "14px",
          overflow: "hidden",
          border: "1px solid rgba(129,140,248,0.1)",
        }}
      >
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
                      default: {
                        fill: "rgba(129,140,248,0.1)",
                        stroke: "rgba(129,140,248,0.2)",
                        strokeWidth: 0.4,
                        outline: "none",
                      },
                      hover: {
                        fill: "rgba(129,140,248,0.2)",
                        outline: "none",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {locations.map((loc, i) => {
              const ipMeta = extractAllIPs(anomalies).get(loc.ip);
              const dotColor = ipMeta
                ? SEV_COLORS[ipMeta.severity]
                : "#fb7185";

              return (
                <Marker
                  key={i}
                  coordinates={[loc.lon, loc.lat]}
                  onMouseEnter={() => setTooltip(loc)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <circle r={8} fill={`${dotColor}20`} stroke="none">
                    <animate
                      attributeName="r"
                      values="6;14;6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    r={5}
                    fill={dotColor}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1.5}
                    style={{
                      cursor: "pointer",
                      filter: `drop-shadow(0 0 4px ${dotColor}99)`,
                    }}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "12px",
              background: "rgba(15,23,42,0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(129,140,248,0.2)",
              borderRadius: "12px",
              padding: "10px 14px",
              fontSize: "12px",
              color: "#e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
          >
            <p className="font-bold">{tooltip.ip}</p>
            <p style={{ color: "#94a3b8" }}>
              {tooltip.city}, {tooltip.country}
            </p>
            <p
              style={{
                color: "#fb7185",
                fontSize: "10px",
                fontFamily: "monospace",
                marginTop: "2px",
              }}
            >
              {String(tooltip.threat_type ?? "UNKNOWN").replace(/_/g, " ")}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
