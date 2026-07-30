import { useState } from "react";
import type { Order } from "../types/api";
import { OrderItemsList } from "./OrderItemsList";

const TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

interface OrderCardProps {
  order: Order;
  position: number;
  onDeliver: (orderId: string) => Promise<void>;
}

export function OrderCard({ order, position, onDeliver }: OrderCardProps) {
  const [delivering, setDelivering] = useState(false);

  const hasUnmatchedItems = order.items.some((item) => !item.matched);

  async function handleDeliverClick() {
    if (delivering) return;
    setDelivering(true);
    try {
      await onDeliver(order.id);
    } finally {
      setDelivering(false);
    }
  }

  return (
    <article className={`order-card${hasUnmatchedItems ? " order-card-warning" : ""}`}>
      <header className="order-card-header">
        <span className="order-position">#{position}</span>
        <span className="order-phone">{order.customerPhone}</span>
        <span className="order-time">{TIME_FORMATTER.format(new Date(order.receivedAt))}</span>
        <span className={`bot-badge ${order.botAnswered ? "bot-badge-ok" : "bot-badge-pending"}`}>
          {order.botAnswered ? "Bot confirmó" : "Bot sin confirmar"}
        </span>
      </header>

      <p className="order-raw-message">"{order.rawMessage}"</p>

      <OrderItemsList items={order.items} />

      <label className="order-deliver">
        <input type="checkbox" checked={delivering} onChange={handleDeliverClick} disabled={delivering} />
        {delivering ? "Guardando..." : "Entregado"}
      </label>
    </article>
  );
}
