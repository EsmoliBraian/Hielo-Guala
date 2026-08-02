import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import type { Order } from "../types/api";
import type { DeliverPayload } from "./DeliverModal";
import { DeliverModal } from "./DeliverModal";
import { IconAlertTriangle, IconGripVertical } from "./icons";

interface CompactOrderRowProps {
  order: Order;
  position: number;
  onDeliver: (orderId: string, payload: DeliverPayload) => Promise<void>;
}

interface BagBreakdownEntry {
  key: string;
  label: string;
  quantity: number;
}

function bagBreakdown(order: Order): BagBreakdownEntry[] {
  const byProduct = new Map<string, BagBreakdownEntry>();
  for (const item of order.items) {
    if (!item.matched || !item.product) continue;
    const key = item.productId ?? item.product.name;
    const existing = byProduct.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byProduct.set(key, { key, label: `${item.product.weightKg}kg`, quantity: item.quantity });
    }
  }
  return Array.from(byProduct.values());
}

/** One order per line — client, bag breakdown, address and the deliver action, nothing else. Drag by the handle to reorder. */
export function CompactOrderRow({ order, position, onDeliver }: CompactOrderRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: order.id });

  const hasUnmatchedItems = order.items.some((item) => !item.matched);
  const bags = useMemo(() => bagBreakdown(order), [order]);
  const clientLabel = order.customer?.name || order.customerPhone;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`compact-row${isDragging ? " compact-row-dragging" : ""}`}>
      <button type="button" className="compact-drag-handle" aria-label="Arrastrar para reordenar" {...attributes} {...listeners}>
        <IconGripVertical width={15} height={15} />
      </button>

      <span className="compact-row-position">{position}</span>

      <span className="compact-row-text">
        <span className="compact-row-client">{clientLabel}</span>
        <span className="compact-row-sep">·</span>
        <span className="compact-row-bags">
          {bags.length > 0 ? (
            bags.map((bag) => (
              <span className="bag-chip" key={bag.key}>
                {bag.label} <strong>×{bag.quantity}</strong>
              </span>
            ))
          ) : (
            <span className="compact-row-muted">sin ítems reconocidos</span>
          )}
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
