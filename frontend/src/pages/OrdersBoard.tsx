import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { OrderCard, type DeliverPayload } from "../components/OrderCard";
import { IconAlertTriangle, IconInbox, IconPlus } from "../components/icons";
import { NewOrderForm } from "../components/NewOrderForm";
import { OrderHistory } from "../components/OrderHistory";
import type { Order } from "../types/api";

const POLL_INTERVAL_MS = 15_000;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await api.get<Order[]>("/orders?status=PENDING");
      setOrders(data);
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

  async function handleDeliver(orderId: string, payload: DeliverPayload) {
    await api.patch(`/orders/${orderId}/deliver`, payload);
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!loading && !error && (
            <span className="count-pill">
              <span className="count-pill-dot" />
              {orders.length} en cola
            </span>
          )}
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

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconInbox width={24} height={24} />
          </span>
          <span className="empty-state-title">No hay pedidos pendientes</span>
          <span>Los nuevos pedidos de WhatsApp van a aparecer acá automáticamente.</span>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="orders-list">
          {orders.map((order, index) => (
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
    </section>

    <OrderHistory />
    </>
  );
}
