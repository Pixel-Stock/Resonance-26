"use client";

import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { Activity } from "lucide-react";
import type { Anomaly, AnalysisResult } from "@/lib/types";

interface MetricsChartProps {
  result: AnalysisResult;
}

interface BucketedPoint {
  time: string;
  events: number;
  anomalies: number;
}

function bucketEvents(anomalies: Anomaly[], totalLogs: number): BucketedPoint[] {
  const byMinute = new Map<string, { events: number; anomalies: number }>();
  const timestamps = anomalies.map((a) => new Date(a.parsed_log.timestamp).getTime());
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const range = maxTs - minTs || 60000;
  const bucketCount = 20;
  const bucketSize = range / bucketCount;
  const normalPerBucket = Math.floor(totalLogs / bucketCount);

  for (let i = 0; i < bucketCount; i++) {
    const t = new Date(minTs + i * bucketSize);
    const key = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    byMinute.set(key, {
      events: normalPerBucket + Math.floor(Math.random() * 5),
      anomalies: 0,
    });
  }

  for (const a of anomalies) {
    const t = new Date(a.parsed_log.timestamp);
    const key = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const existing = byMinute.get(key) || { events: 0, anomalies: 0 };
    existing.events += 1;
    existing.anomalies += 1;
    byMinute.set(key, existing);
  }

  return Array.from(byMinute.entries())
    .sort()
    .map(([time, data]) => ({ time, ...data }));
}

export function MetricsChart({ result }: MetricsChartProps) {
  const data = bucketEvents(result.anomalies, result.total_logs_parsed);
  const anomalyPoints = data.filter((d) => d.anomalies > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <h2 className="text-sm uppercase font-semibold tracking-wider flex items-center gap-2" style={{ color: "#1e293b" }}>
          <Activity className="w-4 h-4 text-violet-500" />
          Event Timeline
        </h2>
        <div className="flex gap-4 text-[10px] font-mono" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #5eead4, #14b8a6)" }} />
            Events
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #fb7185, #e11d48)" }} />
            Anomalies
          </span>
        </div>
      </div>

      <div style={{ height: "200px", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5eead4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#5eead4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1.5px solid rgba(255,255,255,0.5)",
                borderRadius: "14px",
                fontSize: "12px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.05)",
              }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="#2dd4bf"
              strokeWidth={2}
              fill="url(#eventGrad)"
            />
            {anomalyPoints.map((point, i) => (
              <ReferenceDot
                key={i}
                x={point.time}
                y={point.events}
                r={6}
                fill="#fb7185"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row — glass-embossed numbers */}
      <div className="flex gap-4 mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.35)" }}>
        {[
          { value: result.total_logs_parsed, label: "Logs Parsed", color: "#1e293b" },
          { value: result.total_anomalies, label: "Anomalies", color: "#e11d48" },
          {
            value: `${((1 - result.total_anomalies / Math.max(result.total_logs_parsed, 1)) * 100).toFixed(1)}%`,
            label: "Clean Rate",
            color: "#0d9488",
          },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 text-center">
            <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#94a3b8" }}>{stat.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
