import { useState } from "react";
import { api } from "../api/client";
import type { Order } from "../types/api";
import { IconTrash } from "./icons";
import { Modal } from "./Modal";

interface CancelOrderButtonProps {
  order: Order;
  onCancelled: (orderId: string) => void;
  className?: string;
}

/** Icon-only "cancel this order" action — used on the pending board, same idea as the history row's trash icon. */
export function CancelOrderButton({ order, onCancelled, className }: CancelOrderButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setCancelling(true);
    setError(null);
    try {
      await api.patch(`/orders/${order.id}/cancel`);
      setConfirming(false);
      onCancelled(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el pedido");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn-ghost btn-sm"}
        aria-label="Cancelar pedido"
        title="Cancelar pedido"
        onClick={() => setConfirming(true)}
      >
        <IconTrash width={15} height={15} />
      </button>

      {confirming && (
        <Modal title="Cancelar pedido" onClose={() => !cancelling && setConfirming(false)}>
          <p className="modal-summary">{order.customerPhone}</p>
          <p>Esto va a marcar el pedido como cancelado. No se puede deshacer.</p>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="new-order-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={cancelling}>
              Volver
            </button>
            <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={cancelling}>
              {cancelling ? "Cancelando..." : "Sí, cancelar pedido"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
