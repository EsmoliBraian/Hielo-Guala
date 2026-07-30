import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { OrderCard } from "../components/OrderCard";
import type { Order } from "../types/api";

const POLL_INTERVAL_MS = 15_000;

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDeliver(orderId: string) {
    await api.patch(`/orders/${orderId}/deliver`);
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
  }

  if (loading) return <p className="status-message">Cargando pedidos...</p>;
  if (error) return <p className="status-message status-error">{error}</p>;

  return (
    <section>
      <h1>Pedidos pendientes</h1>
      {orders.length === 0 ? (
        <p className="status-message">No hay pedidos pendientes.</p>
      ) : (
        <div className="orders-list">
          {orders.map((order, index) => (
            <OrderCard key={order.id} order={order} position={index + 1} onDeliver={handleDeliver} />
          ))}
        </div>
      )}
    </section>
  );
}
