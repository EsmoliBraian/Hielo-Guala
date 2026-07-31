import { useState } from "react";
import { api } from "../api/client";
import type { Customer, DiscountType, Order, PaymentMethod } from "../types/api";
import { CustomerForm } from "./CustomerForm";
import { CustomerLinkButton } from "./CustomerLinkButton";
import { CustomerPicker } from "./CustomerPicker";
import { IconBankTransfer, IconCash, IconClipboardList, IconClock, IconMapPin, IconPhone } from "./icons";
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

export interface DeliverPayload {
  paymentMethod: PaymentMethod;
  discount?: { type: DiscountType; value: number } | null;
  customerId?: string;
}

interface OrderCardProps {
  order: Order;
  position: number;
  onDeliver: (orderId: string, payload: DeliverPayload) => Promise<void>;
  onCustomerLinked: (order: Order) => void;
}

export function OrderCard({ order, position, onDeliver, onCustomerLinked }: OrderCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [debtCustomers, setDebtCustomers] = useState<Customer[]>([]);
  const [loadingDebtCustomers, setLoadingDebtCustomers] = useState(false);
  const [debtCustomerId, setDebtCustomerId] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const hasUnmatchedItems = order.items.some((item) => !item.matched);
  const estimatedTotal = order.items
    .filter((item) => item.matched && item.product)
    .reduce((sum, item) => sum + item.quantity * Number(item.product!.price), 0);

  const discountNumber = Number(discountValue) || 0;
  const discountAmount =
    !discountEnabled || discountNumber <= 0
      ? 0
      : discountType === "PERCENTAGE"
        ? estimatedTotal * (discountNumber / 100)
        : Math.min(discountNumber, estimatedTotal);
  const finalTotal = Math.max(0, estimatedTotal - discountAmount);

  const needsDebtCustomer = paymentMethod === "DEBT" && !order.customerId;
  const canConfirm = paymentMethod !== "" && (!needsDebtCustomer || Boolean(debtCustomerId));

  function openModal() {
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setDiscountEnabled(false);
    setDiscountValue("");
    setPaymentMethod("");
    setDebtCustomerId("");
  }

  async function handleSelectDebt() {
    setPaymentMethod("DEBT");
    if (!order.customerId && debtCustomers.length === 0) {
      setLoadingDebtCustomers(true);
      try {
        setDebtCustomers(await api.get<Customer[]>("/customers"));
      } finally {
        setLoadingDebtCustomers(false);
      }
    }
  }

  async function handleConfirm() {
    if (!paymentMethod || !canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDeliver(order.id, {
        paymentMethod,
        discount: discountEnabled && discountNumber > 0 ? { type: discountType, value: discountNumber } : null,
        customerId: needsDebtCustomer ? debtCustomerId : undefined,
      });
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
        <label className="order-deliver">
          <input type="checkbox" className="switch-input" checked={false} onChange={openModal} />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          <span className="switch-label">Entregado</span>
        </label>
      </div>

      {modalOpen && (
        <Modal title="Entregar pedido" onClose={closeModal}>
          <p className="modal-summary">
            {order.customerPhone} — {estimatedTotal > 0 ? CURRENCY_FORMATTER.format(estimatedTotal) : "sin precio"}
          </p>

          <div className="discount-section">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(e) => setDiscountEnabled(e.target.checked)}
              />
              Aplicar descuento
            </label>
            {discountEnabled && (
              <>
                <div className="discount-inputs">
                  <select
                    className="select"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  >
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">$ fijo</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step={discountType === "PERCENTAGE" ? "1" : "0.01"}
                    className="input"
                    placeholder={discountType === "PERCENTAGE" ? "Ej: 10" : "Ej: 500"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {discountAmount > 0 && (
                  <p className="discount-preview">
                    Descuento: -{CURRENCY_FORMATTER.format(discountAmount)} → Total:{" "}
                    {CURRENCY_FORMATTER.format(finalTotal)}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="payment-method-options">
            <button
              type="button"
              className={`payment-method-btn${paymentMethod === "CASH" ? " payment-method-btn-active" : ""}`}
              disabled={submitting}
              onClick={() => setPaymentMethod("CASH")}
            >
              <IconCash />
              Efectivo
            </button>
            <button
              type="button"
              className={`payment-method-btn${paymentMethod === "TRANSFER" ? " payment-method-btn-active" : ""}`}
              disabled={submitting}
              onClick={() => setPaymentMethod("TRANSFER")}
            >
              <IconBankTransfer />
              Transferencia
            </button>
            <button
              type="button"
              className={`payment-method-btn${paymentMethod === "DEBT" ? " payment-method-btn-active" : ""}`}
              disabled={submitting}
              onClick={handleSelectDebt}
            >
              <IconClipboardList />
              Deuda pendiente
            </button>
          </div>

          {needsDebtCustomer && (
            <div className="field">
              <label className="field-label">¿A qué cliente se carga la deuda?</label>
              {loadingDebtCustomers ? (
                <p className="status-message status-message-inline">Cargando clientes...</p>
              ) : (
                <CustomerPicker
                  customers={debtCustomers}
                  value={debtCustomerId}
                  noneLabel="Elegir cliente..."
                  onChange={setDebtCustomerId}
                  onRequestCreate={() => setShowCreateCustomer(true)}
                />
              )}
            </div>
          )}

          {submitting && <p className="status-message status-message-inline">Guardando...</p>}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="new-order-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting || !canConfirm}>
              {submitting ? "Guardando..." : "Confirmar entrega"}
            </button>
          </div>
        </Modal>
      )}

      {showCreateCustomer && (
        <CustomerForm
          onClose={() => setShowCreateCustomer(false)}
          onSaved={(customer) => {
            setShowCreateCustomer(false);
            setDebtCustomers((prev) => [...prev, { ...customer, orderCount: 0, totalSpent: 0 }]);
            setDebtCustomerId(customer.id);
          }}
        />
      )}
    </article>
  );
}
