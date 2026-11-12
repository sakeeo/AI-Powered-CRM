"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/modules/reports/chart-spec";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tip = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
};
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function fmt(v: number, spec: ChartSpec, compact = false) {
  if (spec.format === "percent") return `${Math.round(v * 10) / 10}%`;
  const n = new Intl.NumberFormat("id-ID", compact ? { notation: "compact" } : {}).format(v);
  return spec.format === "money" && spec.unit ? `${spec.unit} ${n}` : n;
}

/** Grafik laporan (bar, bar horizontal, donut, garis). Warna dari token seri grafik. */
export function ReportChart({ spec }: { spec: ChartSpec }) {
  if (
    spec.data.length === 0 ||
    spec.data.every((d) => spec.series.every((s) => !Number(d[s.key])))
  ) {
    return (
      <p className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        Tidak ada data pada periode ini.
      </p>
    );
  }
  const common = { data: spec.data };
  let chart: React.ReactElement;
  if (spec.kind === "donut") {
    const key = spec.series[0].key;
    chart = (
      <PieChart>
        <Pie
          data={spec.data}
          dataKey={key}
          nameKey={spec.xKey}
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {spec.data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--card)" />
          ))}
        </Pie>
        <Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v), spec)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    );
  } else if (spec.kind === "line") {
    chart = (
      <LineChart {...common} margin={{ left: 0, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={spec.xKey} tick={axis} tickLine={false} axisLine={false} />
        <YAxis
          tick={axis}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmt(Number(v), spec, true)}
          width={64}
        />
        <Tooltip contentStyle={tip} formatter={(v) => fmt(Number(v), spec)} />
        {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {spec.series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    );
  } else if (spec.kind === "hbar") {
    chart = (
      <BarChart {...common} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={axis}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v) => fmt(Number(v), spec, true)}
        />
        <YAxis
          type="category"
          dataKey={spec.xKey}
          tick={axis}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={tip}
          cursor={{ fill: "var(--muted)" }}
          formatter={(v) => fmt(Number(v), spec)}
        />
        {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {spec.series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={COLORS[i % COLORS.length]}
            radius={[0, 6, 6, 0]}
          />
        ))}
      </BarChart>
    );
  } else {
    chart = (
      <BarChart {...common} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey={spec.xKey} tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis
          tick={axis}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v) => fmt(Number(v), spec, true)}
          width={56}
        />
        <Tooltip
          contentStyle={tip}
          cursor={{ fill: "var(--muted)" }}
          formatter={(v) => fmt(Number(v), spec)}
        />
        {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {spec.series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={COLORS[i % COLORS.length]}
            radius={[6, 6, 0, 0]}
          />
        ))}
      </BarChart>
    );
  }
  return (
    <div role="img" aria-label={spec.title} className="h-64 w-full" data-testid="report-chart">
      <ResponsiveContainer>{chart}</ResponsiveContainer>
    </div>
  );
}
