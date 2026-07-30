import type { OrderItem } from "../types/api";

export function OrderItemsList({ items }: { items: OrderItem[] }) {
  if (items.length === 0) {
    return <p className="order-items-empty">Sin ítems reconocidos — revisar mensaje original.</p>;
  }

  return (
    <ul className="order-items">
      {items.map((item) => (
        <li key={item.id} className={item.matched ? "" : "order-item-unmatched"}>
          {item.matched ? (
            <>
              <strong>{item.quantity}x</strong> {item.product?.name ?? "Producto"}
            </>
          ) : (
            <>
              ⚠️ No reconocido: "{item.rawFragment}" — revisar manualmente
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
