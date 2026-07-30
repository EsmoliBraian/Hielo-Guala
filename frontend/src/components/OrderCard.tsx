import { useState } from "react";
import type { Order } from "../types/api";
import { IconClock, IconPhone } from "./icons";
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
    <article className={`order-card animate-in${hasUnmatchedItems ? " order-card-warning" : ""}`}>
      <header className="order-card-header">
        <span className="order-position">#{position}</span>
        <span className="order-phone">
          <IconPhone width={15} height={15} />
          {order.customerPhone}
        </span>
        <span className="order-time">
          <IconClock width={15} height={15} />
          {TIME_FORMATTER.format(new Date(order.receivedAt))}
        </span>
        {order.waMessageId === null ? (
          <span className="badge badge-primary">
            <span className="badge-dot" />
            Pedido manual
          </span>
        ) : (
          <span className={`badge ${order.botAnswered ? "badge-success" : "badge-warning"}`}>
            <span className="badge-dot" />
            {order.botAnswered ? "Bot confirmó" : "Bot sin confirmar"}
          </span>
        )}
      </header>

      <p className="order-raw-message">"{order.rawMessage}"</p>

      <OrderItemsList items={order.items} />

      <label className="order-deliver">
        <input
          type="checkbox"
          className="switch-input"
          checked={delivering}
          onChange={handleDeliverClick}
          disabled={delivering}
        />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
        <span className="switch-label">{delivering ? "Guardando..." : "Entregado"}</span>
      </label>
    </article>
  );
}
