import { useState } from "react";
import { api } from "../api/client";
import type { Customer, DiscountType, Order, PaymentMethod } from "../types/api";
import { CustomerForm } from "./CustomerForm";
import { CustomerPicker } from "./CustomerPicker";
import { IconBankTransfer, IconCash, IconClipboardList } from "./icons";
import { Modal } from "./Modal";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export interface DeliverPayload {
  paymentMethod: PaymentMethod;
  discount?: { type: DiscountType; value: number } | null;
  customerId?: string;
  /** Custom unit price per OrderItem id — only for items whose price got edited from the catalog value. */
  itemPrices?: Record<string, number>;
}

interface DeliverModalProps {
  order: Order;
  onClose: () => void;
  onDeliver: (orderId: string, payload: DeliverPayload) => Promise<void>;
}

/** The "¿Cómo pagó?" flow — per-product price overrides, discount, payment method, and (for debt) a customer to charge it to. */
export function DeliverModal({ order, onClose, onDeliver }: DeliverModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceableItems = order.items.filter((item) => item.matched && item.product);
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(priceableItems.map((item) => [item.id, item.product!.price])),
  );

  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [debtCustomers, setDebtCustomers] = useState<Customer[]>([]);
  const [loadingDebtCustomers, setLoadingDebtCustomers] = useState(false);
  const [debtCustomerId, setDebtCustomerId] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const estimatedTotal = priceableItems.reduce(
    (sum, item) => sum + item.quantity * (Number(itemPrices[item.id]) || 0),
    0,
  );

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

  function handleClose() {
    if (submitting) return;
    onClose();
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
        itemPrices: Object.fromEntries(
          Object.entries(itemPrices).map(([itemId, value]) => [itemId, Number(value) || 0]),
        ),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal title="Entregar pedido" onClose={handleClose}>
        <p className="modal-summary">
          {order.customerPhone} — {estimatedTotal > 0 ? CURRENCY_FORMATTER.format(estimatedTotal) : "sin precio"}
        </p>

        {priceableItems.length > 0 && (
          <div className="field">
            <label className="field-label">Precios (editables, por si este pedido lleva un precio distinto)</label>
            <div className="item-price-rows">
              {priceableItems.map((item) => (
                <div className="item-price-row" key={item.id}>
                  <span className="item-price-label">
                    {item.quantity}x {item.product!.name}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input item-price-input"
                    value={itemPrices[item.id] ?? ""}
                    onChange={(e) => setItemPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="discount-section">
          <label className="checkbox-row">
            <input type="checkbox" checked={discountEnabled} onChange={(e) => setDiscountEnabled(e.target.checked)} />
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
                  Descuento: -{CURRENCY_FORMATTER.format(discountAmount)} → Total: {CURRENCY_FORMATTER.format(finalTotal)}
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
            Deuda
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
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting || !canConfirm}>
            {submitting ? "Guardando..." : "Confirmar entrega"}
          </button>
        </div>
      </Modal>

      {showCreateCustomer && (
        <CustomerForm
          onClose={() => setShowCreateCustomer(false)}
          onSaved={(customer) => {
            setShowCreateCustomer(false);
            setDebtCustomers((prev) => [...prev, { ...customer, orderCount: 0, totalSpent: 0, pendingDebt: 0 }]);
            setDebtCustomerId(customer.id);
          }}
        />
      )}
    </>
  );
}
