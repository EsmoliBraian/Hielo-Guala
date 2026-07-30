import { useEffect, useState } from "react";
import { api } from "../api/client";
import { MetricsChart } from "../components/MetricsChart";
import type { SalesMetrics as SalesMetricsData } from "../types/api";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function SalesMetrics() {
  const [from, setFrom] = useState(isoDateDaysAgo(30));
  const [to, setTo] = useState(isoDateDaysAgo(0));
  const [groupBy, setGroupBy] = useState<"day" | "week">("day");
  const [metrics, setMetrics] = useState<SalesMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMetrics() {
    setLoading(true);
    const params = new URLSearchParams({
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59`).toISOString(),
      groupBy,
    });
    const data = await api.get<SalesMetricsData>(`/sales/metrics?${params}`);
    setMetrics(data);
    setLoading(false);
  }

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, groupBy]);

  return (
    <section>
      <h1>Métricas de ventas</h1>

      <div className="metrics-filters">
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Agrupar por
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "day" | "week")}>
            <option value="day">Día</option>
            <option value="week">Semana</option>
          </select>
        </label>
      </div>

      {loading || !metrics ? (
        <p className="status-message">Cargando métricas...</p>
      ) : (
        <>
          <div className="stat-tile">
            <span className="stat-tile-label">Ingresos totales</span>
            <span className="stat-tile-value">{CURRENCY_FORMATTER.format(metrics.totalRevenue)}</span>
          </div>

          <h3>Por producto</h3>
          <MetricsChart
            data={metrics.byProduct.map((p) => ({ label: p.productName, revenue: p.revenue }))}
          />

          <h3>Por período</h3>
          <MetricsChart
            data={metrics.byPeriod.map((p) => ({ label: p.period, revenue: p.revenue }))}
          />
        </>
      )}
    </section>
  );
}
