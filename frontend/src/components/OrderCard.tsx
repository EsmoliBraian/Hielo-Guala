import { useState } from "react";
import type { Order } from "../types/api";
import { CancelOrderButton } from "./CancelOrderButton";
import { CustomerLinkButton } from "./CustomerLinkButton";
import type { DeliverPayload } from "./DeliverModal";
import { DeliverModal } from "./DeliverModal";
import { IconClock, IconMapPin, IconPhone, IconUsers } from "./icons";
import { OrderItemsList } from "./OrderItemsList";

const TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export type { DeliverPayload };

interface OrderCardProps {
  order: Order;
  position: number;
  onDeliver: (orderId: string, payload: DeliverPayload) => Promise<void>;
  onCustomerLinked: (order: Order) => void;
  onCancelled: (orderId: string) => void;
}

export function OrderCard({ order, position, onDeliver, onCustomerLinked, onCancelled }: OrderCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const hasUnmatchedItems = order.items.some((item) => !item.matched);

  return (
    <article className={`order-card animate-in${hasUnmatchedItems ? " order-card-warning" : ""}`}>
      <header className="order-card-header">
        <span className="order-position">#{position}</span>
        <span className="order-phone">
          {order.customer?.name ? (
            <>
              <IconUsers width={15} height={15} />
              {order.customer.name}
            </>
          ) : (
            <>
              <IconPhone width={15} height={15} />
              {order.customerPhone}
            </>
          )}
        </span>
        {order.deliveryAddress && (
          <span className="order-address" title={order.deliveryAddress}>
            <IconMapPin width={15} height={15} />
            {order.deliveryAddress}
          </span>
        )}
        <span className="order-time">
          <IconClock width={15} height={15} />
          {TIME_FORMATTER.format(new Date(order.receivedAt))}
        </span>
        {!order.deliveryAddress && order.addressRequestedAt && (
          <span className="badge badge-warning">
            <span className="badge-dot" />
            Esperando dirección
          </span>
        )}
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

      <div className="order-card-footer">
        <CustomerLinkButton order={order} onLinked={onCustomerLinked} />
        <CancelOrderButton order={order} onCancelled={onCancelled} className="btn btn-ghost btn-sm order-cancel-btn" />
        <label className="order-deliver">
          <input type="checkbox" className="switch-input" checked={false} onChange={() => setModalOpen(true)} />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className="switch-label">Entregado</span>
        </label>
      </div>

      {modalOpen && <DeliverModal order={order} onClose={() => setModalOpen(false)} onDeliver={onDeliver} />}
    </article>
  );
}
