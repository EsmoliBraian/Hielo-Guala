import { useEffect, useState } from "react";
import { api } from "../api/client";
import { RankedBarList } from "../components/RankedBarList";
import { IconBankTransfer, IconCash, IconClipboardList, IconTrendingUp } from "../components/icons";
import type { SalesMetrics as SalesMetricsData } from "../types/api";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const PERIOD_LABEL_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function periodLabel(period: string): string {
  return PERIOD_LABEL_FORMATTER.format(new Date(`${period}T12:00:00`));
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  DEBT: "Deuda pendiente",
  SIN_ESPECIFICAR: "Sin especificar",
};

const PAYMENT_METHOD_ICONS: Record<string, typeof IconCash> = {
  CASH: IconCash,
  TRANSFER: IconBankTransfer,
  DEBT: IconClipboardList,
};

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
      <div className="page-header">
        <div>
          <h1>Métricas de ventas</h1>
          <p className="page-subtitle">Ingresos por producto y por período</p>
        </div>
      </div>

      <div className="metrics-filters">
        <div className="field">
          <label className="field-label" htmlFor="metrics-from">
            Desde
          </label>
          <input
            id="metrics-from"
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="metrics-to">
            Hasta
          </label>
          <input
            id="metrics-to"
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="metrics-groupby">
            Agrupar por
          </label>
          <select
            id="metrics-groupby"
            className="select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "day" | "week")}
          >
            <option value="day">Día</option>
            <option value="week">Semana</option>
          </select>
        </div>
      </div>

      {loading || !metrics ? (
        <div className="card order-card-skeleton" style={{ marginBottom: 24 }}>
          <div className="skeleton" style={{ width: "30%", height: 30 }} />
        </div>
      ) : (
        <>
          <div className="stat-tile stat-tile-hero animate-in">
            <span className="stat-tile-icon">
              <IconTrendingUp width={22} height={22} />
            </span>
            <div>
              <div className="stat-tile-label">Ingresos totales</div>
              <div className="stat-tile-value">{CURRENCY_FORMATTER.format(metrics.totalRevenue)}</div>
            </div>
          </div>

          <h3>Por método de pago</h3>
          <div className="stat-tile-row">
            {metrics.byPaymentMethod.map(({ paymentMethod, revenue }) => {
              const Icon = PAYMENT_METHOD_ICONS[paymentMethod] ?? IconCash;
              return (
                <div className="stat-tile stat-tile-sm animate-in" key={paymentMethod}>
                  <span className="stat-tile-icon">
                    <Icon width={18} height={18} />
                  </span>
                  <div>
                    <div className="stat-tile-label">{PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}</div>
                    <div className="stat-tile-value stat-tile-value-sm">{CURRENCY_FORMATTER.format(revenue)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {metrics.byProduct.length > 0 && (
            <>
              <h3>Por producto</h3>
              <RankedBarList
                items={metrics.byProduct.map((p) => ({
                  id: p.productId ?? p.productName,
                  label: p.productName,
                  value: p.revenue,
                }))}
                formatValue={(v) => CURRENCY_FORMATTER.format(v)}
              />
            </>
          )}

          {metrics.byPeriod.length > 0 && (
            <>
              <h3>Por período</h3>
              <RankedBarList
                items={metrics.byPeriod.map((p) => ({
                  id: p.period,
                  label: periodLabel(p.period),
                  value: p.revenue,
                }))}
                formatValue={(v) => CURRENCY_FORMATTER.format(v)}
              />
            </>
          )}

          {metrics.topCustomersByQuantity.length > 0 && (
            <>
              <h3>Top 10 clientes por cantidad de productos</h3>
              <RankedBarList
                items={metrics.topCustomersByQuantity.map((c) => ({
                  id: c.customerId,
                  label: c.customerName,
                  value: c.quantity,
                }))}
                formatValue={(v) => `${v} productos`}
              />
            </>
          )}

          {metrics.topCustomersByRevenue.length > 0 && (
            <>
              <h3>Top 10 clientes por dinero gastado</h3>
              <RankedBarList
                items={metrics.topCustomersByRevenue.map((c) => ({
                  id: c.customerId,
                  label: c.customerName,
                  value: c.revenue,
                }))}
                formatValue={(v) => CURRENCY_FORMATTER.format(v)}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
