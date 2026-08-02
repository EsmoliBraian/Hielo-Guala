import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { CompactOrderRow } from "../components/CompactOrderRow";
import { OrderCard, type DeliverPayload } from "../components/OrderCard";
import { IconAlertTriangle, IconInbox, IconLayoutList, IconListCompact, IconPlus } from "../components/icons";
import { NewOrderForm } from "../components/NewOrderForm";
import { OrderHistory } from "../components/OrderHistory";
import type { Order } from "../types/api";

const POLL_INTERVAL_MS = 15_000;
const VIEW_MODE_STORAGE_KEY = "hielo-guala-orders-view-mode";

type ViewMode = "detailed" | "compact";

function loadStoredViewMode(): ViewMode {
  return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "compact" ? "compact" : "detailed";
}

/** Keeps any manual reordering the staff did — new orders join at the end, delivered/cancelled ones drop out. */
function mergeOrderIds(previousIds: string[], serverOrders: Order[]): string[] {
  const serverIds = new Set(serverOrders.map((o) => o.id));
  const kept = previousIds.filter((id) => serverIds.has(id));
  const known = new Set(kept);
  const newOnes = serverOrders.filter((o) => !known.has(o.id)).map((o) => o.id);
  return [...kept, ...newOnes];
}

function OrderCardSkeleton() {
  return (
    <div className="card order-card-skeleton">
      <div className="skeleton" style={{ width: "40%" }} />
      <div className="skeleton" style={{ width: "90%" }} />
      <div className="skeleton" style={{ width: "70%" }} />
      <div className="skeleton" style={{ width: "30%", height: 24 }} />
    </div>
  );
}

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(loadStoredViewMode);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.get<Order[]>("/orders?status=PENDING");
      setOrders(data);
      setOrderIds((prev) => mergeOrderIds(prev, data));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadOrders]);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const displayOrders = useMemo(
    () => orderIds.map((id) => ordersById.get(id)).filter((o): o is Order => Boolean(o)),
    [orderIds, ordersById],
  );

  function moveOrder(index: number, direction: -1 | 1) {
    setOrderIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleDeliver(orderId: string, payload: DeliverPayload) {
    await api.patch(`/orders/${orderId}/deliver`, payload);
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
    setOrderIds((prev) => prev.filter((id) => id !== orderId));
  }

  function handleCustomerLinked(updated: Order) {
    setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
  }

  async function handleOrderCreated() {
    setShowNewOrderForm(false);
    await loadOrders();
  }

  return (
    <>
    <section>
      <div className="page-header">
        <div>
          <h1>Pedidos pendientes</h1>
          <p className="page-subtitle">Ordenados por quién pidió primero</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!loading && !error && (
            <span className="count-pill">
              <span className="count-pill-dot" />
              {orders.length} en cola
            </span>
          )}
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn${viewMode === "detailed" ? " view-toggle-btn-active" : ""}`}
              onClick={() => changeViewMode("detailed")}
            >
              <IconLayoutList width={14} height={14} />
              Vista detallada
            </button>
            <button
              type="button"
              className={`view-toggle-btn${viewMode === "compact" ? " view-toggle-btn-active" : ""}`}
              onClick={() => changeViewMode("compact")}
            >
              <IconListCompact width={14} height={14} />
              Vista resumida
            </button>
          </div>
          {!showNewOrderForm && (
            <button type="button" className="btn btn-primary" onClick={() => setShowNewOrderForm(true)}>
              <IconPlus width={16} height={16} />
              Nuevo pedido
            </button>
          )}
        </div>
      </div>

      {showNewOrderForm && (
        <NewOrderForm onCreated={handleOrderCreated} onCancel={() => setShowNewOrderForm(false)} />
      )}

      {loading && (
        <div className="orders-list">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-error">
          <IconAlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && displayOrders.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconInbox width={24} height={24} />
          </span>
          <span className="empty-state-title">No hay pedidos pendientes</span>
          <span>Los nuevos pedidos de WhatsApp van a aparecer acá automáticamente.</span>
        </div>
      )}

      {!loading && !error && displayOrders.length > 0 && viewMode === "detailed" && (
        <div className="orders-list">
          {displayOrders.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              position={index + 1}
              onDeliver={handleDeliver}
              onCustomerLinked={handleCustomerLinked}
            />
          ))}
        </div>
      )}

      {!loading && !error && displayOrders.length > 0 && viewMode === "compact" && (
        <div className="compact-list">
          {displayOrders.map((order, index) => (
            <CompactOrderRow
              key={order.id}
              order={order}
              position={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < displayOrders.length - 1}
              onMoveUp={() => moveOrder(index, -1)}
              onMoveDown={() => moveOrder(index, 1)}
              onDeliver={handleDeliver}
            />
          ))}
        </div>
      )}
    </section>

    <OrderHistory />
    </>
  );
}
