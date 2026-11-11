"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
};

/** Jumlah deal terbuka per stage. Warna dari token seri grafik (chart-1…). */
export function PipelineChart({ data }: { data: { name: string; deals: number }[] }) {
  return (
    <div role="img" aria-label="Grafik jumlah deal terbuka per stage" className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="deals" name="Deal" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadSeriesChart({ data }: { data: { date: string; leads: number }[] }) {
  return (
    <div role="img" aria-label="Grafik lead baru per hari" className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={axis}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tip} />
          <Area
            type="monotone"
            dataKey="leads"
            name="Lead baru"
            stroke="var(--chart-2)"
            fill="var(--chart-2)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceChart({
  data,
}: {
  data: { name: string; leads: number; converted: number }[];
}) {
  return (
    <div role="img" aria-label="Grafik lead dan konversi per sumber" className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={axis}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="leads" name="Lead" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
          <Bar dataKey="converted" name="Terkonversi" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
