import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconTrendingUp } from "./icons";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

interface MetricsChartProps {
  data: { label: string; revenue: number }[];
  xKey?: string;
}

export function MetricsChart({ data }: MetricsChartProps) {
  if (data.length === 0) {
    return (
      <div className="empty-state" style={{ marginBottom: 24, padding: 32 }}>
        <span className="empty-state-icon">
          <IconTrendingUp width={20} height={20} />
        </span>
        <span>Sin datos para el período seleccionado.</span>
      </div>
    );
  }

  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke="var(--gridline)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--baseline)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={70}
            tickFormatter={(value: number) => CURRENCY_FORMATTER.format(value)}
          />
          <Tooltip
            cursor={{ fill: "var(--gridline)" }}
            formatter={(value) => CURRENCY_FORMATTER.format(Number(value))}
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--gridline)",
              borderRadius: 12,
              boxShadow: "var(--shadow-md)",
              color: "var(--text-primary)",
            }}
          />
          <Bar dataKey="revenue" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
