import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Order } from "../types/api";
import { IconAlertTriangle, IconClock, IconInbox, IconPhone, IconX } from "./icons";
import { Modal } from "./Modal";

const DAY_OPTIONS = [
  { value: 1, label: "Hoy" },
  { value: 7, label: "Últimos 7 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
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

export function OrderHistory() {
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadHistory = useCallback(async (forDays: number) => {
    setLoading(true);
    try {
      const data = await api.get<Order[]>(`/orders/history?days=${forDays}`);
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando el historial");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(days);
  }, [days, loadHistory]);

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.patch(`/orders/${cancelTarget.id}/cancel`);
      setCancelTarget(null);
      await loadHistory(days);
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
        <select className="select history-days-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {DAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order) => (
            <article key={order.id} className="card history-row">
              <div className="history-row-main">
                <div className="history-row-meta">
                  <span className="order-phone">
                    <IconPhone width={14} height={14} />
                    {order.customerPhone}
                  </span>
                  <span className="order-time">
                    <IconClock width={14} height={14} />
                    {DATE_FORMATTER.format(new Date(order.receivedAt))}
                  </span>
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
                {order.sale && <span className="history-row-total">{CURRENCY_FORMATTER.format(Number(order.sale.totalAmount))}</span>}
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
