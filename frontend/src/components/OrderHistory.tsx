import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Order } from "../types/api";
import { IconAlertTriangle, IconClock, IconInbox, IconMapPin, IconPhone, IconX } from "./icons";
import { Modal } from "./Modal";

const DAY_OPTIONS = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "Últimos 7 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
];

const TZ = "America/Argentina/Buenos_Aires";

const TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // -> YYYY-MM-DD

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TZ,
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

function itemsSummary(order: Order): string {
  const matched = order.items.filter((item) => item.matched);
  const parts = matched.map((item) => `${item.quantity}x ${item.product?.name ?? "producto"}`);
  const unmatchedCount = order.items.length - matched.length;
  if (unmatchedCount > 0) parts.push(`${unmatchedCount} sin reconocer`);
  return parts.join(", ") || "Sin ítems";
}

function dayKey(iso: string): string {
  return DAY_KEY_FORMATTER.format(new Date(iso));
}

function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Hoy";
  if (key === yesterday) return "Ayer";
  const label = DAY_LABEL_FORMATTER.format(new Date(`${key}T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface TimelineGroup {
  key: string;
  label: string;
  orders: Order[];
}

function groupByDay(orders: Order[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const order of orders) {
    const key = dayKey(order.receivedAt);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.orders.push(order);
    } else {
      groups.push({ key, label: dayLabel(key), orders: [order] });
    }
  }
  return groups;
}

interface OrderHistoryProps {
  /** Scopes the history to a single customer's orders (used by the customer detail view). */
  customerId?: string;
}

export function OrderHistory({ customerId }: OrderHistoryProps = {}) {
  const [days, setDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD, empty = use `days` instead
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (forDays: number, forDate: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (forDate) params.set("date", forDate);
        else params.set("days", String(forDays));
        if (customerId) params.set("customerId", customerId);

        const data = await api.get<Order[]>(`/orders/history?${params}`);
        setOrders(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando el historial");
      } finally {
        setLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    loadHistory(days, selectedDate);
  }, [days, selectedDate, loadHistory]);

  const groups = useMemo(() => groupByDay(orders), [orders]);

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.patch(`/orders/${cancelTarget.id}/cancel`);
      setCancelTarget(null);
      await loadHistory(days, selectedDate);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "No se pudo cancelar el pedido");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="history-section">
      <div className="page-header">
        <div>
          <h1>Historial</h1>
          <p className="page-subtitle">Pedidos entregados o cancelados</p>
        </div>
        <div className="history-filters">
          <select
            className="select history-days-select"
            value={days}
            disabled={Boolean(selectedDate)}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input history-date-input"
            value={selectedDate}
            max={dayKey(new Date().toISOString())}
            onChange={(e) => setSelectedDate(e.target.value)}
            aria-label="Buscar por fecha específica"
          />
          {selectedDate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedDate("")}
              aria-label="Quitar filtro de fecha"
            >
              <IconX width={14} height={14} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="card order-card-skeleton">
          <div className="skeleton" style={{ width: "50%" }} />
          <div className="skeleton" style={{ width: "80%" }} />
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-error">
          <IconAlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconInbox width={24} height={24} />
          </span>
          <span className="empty-state-title">Sin movimientos en este período</span>
          <span>Los pedidos entregados o cancelados van a ir apareciendo acá.</span>
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="timeline">
          {groups.map((group) => (
            <div className="timeline-group" key={group.key}>
              <div className="timeline-day-label">{group.label}</div>
              {group.orders.map((order) => (
                <div className="timeline-item" key={order.id}>
                  <div className="timeline-marker">
                    <span className={`timeline-dot${order.status === "CANCELLED" ? " timeline-dot-cancelled" : ""}`} />
                    <span className="timeline-line" />
                  </div>

                  <article className="card history-row">
                    <div className="history-row-main">
                      <div className="history-row-meta">
                        <span className="order-time">
                          <IconClock width={13} height={13} />
                          {TIME_FORMATTER.format(new Date(order.receivedAt))}
                        </span>
                        <span className="order-phone">
                          <IconPhone width={13} height={13} />
                          {order.customerPhone}
                        </span>
                        {order.deliveryAddress && (
                          <span className="order-address" title={order.deliveryAddress}>
                            <IconMapPin width={13} height={13} />
                            {order.deliveryAddress}
                          </span>
                        )}
                        <span className={`badge ${order.status === "DELIVERED" ? "badge-success" : "badge-neutral"}`}>
                          <span className="badge-dot" />
                          {order.status === "DELIVERED" ? "Entregado" : "Cancelado"}
                        </span>
                        {order.sale?.paymentMethod && (
                          <span className="badge badge-primary">
                            {PAYMENT_METHOD_LABELS[order.sale.paymentMethod] ?? order.sale.paymentMethod}
                          </span>
                        )}
                      </div>
                      <p className="history-row-items">{itemsSummary(order)}</p>
                    </div>
                    <div className="history-row-actions">
                      {order.sale && (
                        <span className="history-row-total">
                          {CURRENCY_FORMATTER.format(Number(order.sale.totalAmount))}
                        </span>
                      )}
                      {order.status === "DELIVERED" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm history-cancel-btn"
                          onClick={() => {
                            setCancelError(null);
                            setCancelTarget(order);
                          }}
                        >
                          <IconX width={14} height={14} />
                          Cancelar
                        </button>
                      )}
                    </div>
                  </article>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <Modal title="Cancelar pedido" onClose={() => !cancelling && setCancelTarget(null)}>
          <p className="modal-summary">
            {cancelTarget.customerPhone} — {itemsSummary(cancelTarget)}
          </p>
          <p>
            Esto va a marcar el pedido como cancelado
            {cancelTarget.sale ? " y va a borrar la venta asociada de las métricas" : ""}. No se puede deshacer.
          </p>

          {cancelError && (
            <div className="alert alert-error">
              <span>{cancelError}</span>
            </div>
          )}

          <div className="new-order-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Volver
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirmCancel} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Sí, cancelar pedido"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
