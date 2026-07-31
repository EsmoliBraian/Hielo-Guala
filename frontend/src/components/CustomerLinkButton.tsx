import { useState } from "react";
import { api } from "../api/client";
import type { Customer, Order } from "../types/api";
import { CustomerForm } from "./CustomerForm";
import { CustomerPicker } from "./CustomerPicker";
import { IconUsers } from "./icons";
import { Modal } from "./Modal";

interface CustomerLinkButtonProps {
  order: Order;
  onLinked: (order: Order) => void;
}

/** Lets staff associate a customer to an order that has none — typically a WhatsApp order from an unrecognized phone. */
export function CustomerLinkButton({ order, onLinked }: CustomerLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.customerId) return null;

  async function openModal() {
    setOpen(true);
    setError(null);
    setLoadingCustomers(true);
    try {
      setCustomers(await api.get<Customer[]>("/customers"));
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function handleLink(customerId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/customer`, { customerId });
      onLinked(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={openModal}>
        <IconUsers width={14} height={14} />
        Vincular cliente
      </button>

      {open && (
        <Modal title="Vincular a un cliente" onClose={() => !submitting && setOpen(false)}>
          <p className="modal-summary">{order.customerPhone}</p>

          {loadingCustomers ? (
            <p className="status-message status-message-inline">Cargando clientes...</p>
          ) : (
            <CustomerPicker
              customers={customers}
              value=""
              noneLabel="Elegir cliente..."
              onChange={handleLink}
              onRequestCreate={() => setShowCustomerForm(true)}
            />
          )}

          {submitting && <p className="status-message status-message-inline">Vinculando...</p>}
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
        </Modal>
      )}

      {showCustomerForm && (
        <CustomerForm
          onClose={() => setShowCustomerForm(false)}
          onSaved={(customer) => {
            setShowCustomerForm(false);
            handleLink(customer.id);
          }}
        />
      )}
    </>
  );
}
