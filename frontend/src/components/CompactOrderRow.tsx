import { useState } from "react";
import type { Order } from "../types/api";
import type { DeliverPayload } from "./DeliverModal";
import { DeliverModal } from "./DeliverModal";
import { IconAlertTriangle, IconChevronDown, IconChevronUp } from "./icons";

interface CompactOrderRowProps {
  order: Order;
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeliver: (orderId: string, payload: DeliverPayload) => Promise<void>;
}

/** One order per line — client, bag count, address and the deliver action, nothing else. */
export function CompactOrderRow({
  order,
  position,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDeliver,
}: CompactOrderRowProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const hasUnmatchedItems = order.items.some((item) => !item.matched);
  const totalBags = order.items.filter((item) => item.matched).reduce((sum, item) => sum + item.quantity, 0);
  const clientLabel = order.customer?.name || order.customerPhone;

  return (
    <div className="compact-row animate-in">
      <span className="compact-row-position">{position}</span>

      <div className="compact-row-moves">
        <button
          type="button"
          className="compact-move-btn"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label="Subir prioridad"
        >
          <IconChevronUp width={12} height={12} />
        </button>
        <button
          type="button"
          className="compact-move-btn"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label="Bajar prioridad"
        >
          <IconChevronDown width={12} height={12} />
        </button>
      </div>

      <span className="compact-row-text">
        <span className="compact-row-client">{clientLabel}</span>
        <span className="compact-row-sep">·</span>
        <span className="compact-row-bags">
          {totalBags} bolsa{totalBags === 1 ? "" : "s"}
        </span>
        {hasUnmatchedItems && (
          <span className="compact-row-warning" title="Hay ítems del pedido sin reconocer">
            <IconAlertTriangle width={12} height={12} />
          </span>
        )}
        <span className="compact-row-sep">·</span>
        <span className="compact-row-address">{order.deliveryAddress ?? "Sin dirección"}</span>
      </span>

      <button type="button" className="btn btn-primary btn-sm compact-row-deliver" onClick={() => setModalOpen(true)}>
        Entregado
      </button>

      {modalOpen && <DeliverModal order={order} onClose={() => setModalOpen(false)} onDeliver={onDeliver} />}
    </div>
  );
}
