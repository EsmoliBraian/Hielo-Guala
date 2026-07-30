import type { OrderItem } from "../types/api";
import { IconAlertTriangle, IconPackage } from "./icons";

export function OrderItemsList({ items }: { items: OrderItem[] }) {
  if (items.length === 0) {
    return (
      <p className="order-items-empty">
        <IconAlertTriangle width={16} height={16} />
        Sin ítems reconocidos — revisar mensaje original.
      </p>
    );
  }

  return (
    <ul className="order-items">
      {items.map((item) => (
        <li key={item.id} className={item.matched ? "" : "order-item-unmatched"}>
          {item.matched ? (
            <>
              <IconPackage width={16} height={16} />
              <span className="item-qty">{item.quantity}×</span>
              {item.product?.name ?? "Producto"}
            </>
          ) : (
            <>
              <IconAlertTriangle width={16} height={16} />
              No reconocido: "{item.rawFragment}" — revisar manualmente
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
