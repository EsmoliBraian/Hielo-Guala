import { useState } from "react";
import type { Order, PaymentMethod } from "../types/api";
import { IconBankTransfer, IconCash, IconClock, IconPhone } from "./icons";
import { Modal } from "./Modal";
import { OrderItemsList } from "./OrderItemsList";

const TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

interface OrderCardProps {
  order: Order;
  position: number;
  onDeliver: (orderId: string, paymentMethod: PaymentMethod) => Promise<void>;
}

export function OrderCard({ order, position, onDeliver }: OrderCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUnmatchedItems = order.items.some((item) => !item.matched);
  const estimatedTotal = order.items
    .filter((item) => item.matched && item.product)
    .reduce((sum, item) => sum + item.quantity * Number(item.product!.price), 0);

  function openModal() {
    setError(null);
    setModalOpen(true);
  }

  async function handleSelectPayment(paymentMethod: PaymentMethod) {
    setSubmitting(true);
    setError(null);
    try {
      await onDeliver(order.id, paymentMethod);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar el pedido");
    } finally {
      setSubmitting(false);
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
        <input type="checkbox" className="switch-input" checked={false} onChange={openModal} />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
        <span className="switch-label">Entregado</span>
      </label>

      {modalOpen && (
        <Modal title="¿Cómo pagó?" onClose={() => !submitting && setModalOpen(false)}>
          <p className="modal-summary">
            {order.customerPhone} — {estimatedTotal > 0 ? CURRENCY_FORMATTER.format(estimatedTotal) : "sin precio"}
          </p>

          <div className="payment-method-options">
            <button
              type="button"
              className="payment-method-btn"
              disabled={submitting}
              onClick={() => handleSelectPayment("CASH")}
            >
              <IconCash />
              Efectivo
            </button>
            <button
              type="button"
              className="payment-method-btn"
              disabled={submitting}
              onClick={() => handleSelectPayment("TRANSFER")}
            >
              <IconBankTransfer />
              Transferencia
            </button>
          </div>

          {submitting && <p className="status-message status-message-inline">Guardando...</p>}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
        </Modal>
      )}
    </article>
  );
}
