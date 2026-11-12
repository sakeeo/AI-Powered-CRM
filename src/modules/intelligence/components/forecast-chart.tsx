"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ForecastPoint = { month: string; p10: number; p50: number; p90: number };

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const compact = (v: number) => new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v);

/** Rentang P10–P90 (batang melayang) dengan penanda P50. Estimasi, bukan jaminan. */
export function ForecastChart({ data, currency }: { data: ForecastPoint[]; currency: string }) {
  const rows = data.map((d) => ({ ...d, base: d.p10, range: Math.max(0, d.p90 - d.p10) }));
  const money = (v: number) =>
    `${currency} ${new Intl.NumberFormat("id-ID").format(Math.round(v))}`;
  return (
    <div
      className="h-72 w-full"
      data-testid="forecast-chart"
      role="img"
      aria-label="Rentang forecast P10 sampai P90 per bulan"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
          <Tooltip
            formatter={(v, name) =>
              name === "base"
                ? [money(Number(v)), "P10"]
                : name === "range"
                  ? [money(Number(v)), "Selisih P90 − P10"]
                  : [money(Number(v)), "P50 (median)"]
            }
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="base" stackId="r" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="range"
            stackId="r"
            fill="var(--chart-1)"
            fillOpacity={0.25}
            radius={[6, 6, 6, 6]}
            isAnimationActive={false}
          />
          <Line
            dataKey="p50"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
