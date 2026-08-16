import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Customer, Product } from "../types/api";
import { CustomerForm } from "./CustomerForm";
import { CustomerPicker } from "./CustomerPicker";
import { IconPlus, IconX } from "./icons";

interface LineItem {
  productId: string;
  /** Kept as a string while editing so the field can be cleared/retyped —
   *  a number-typed value snaps to 0 the instant the input is emptied. */
  quantity: string;
}

interface NewOrderFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function NewOrderForm({ onCreated, onCancel }: NewOrderFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [lines, setLines] = useState<LineItem[]>([{ productId: "", quantity: "1" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Product[]>("/products").then(setProducts);
    api.get<Customer[]>("/customers").then(setCustomers);
  }, []);

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const picked = lines.filter((line) => line.productId);
    if (picked.length === 0) {
      setError("Elegí al menos un producto.");
      return;
    }

    const invalid = picked.find((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1);
    if (invalid) {
      setError("Revisá las cantidades — tienen que ser números enteros de 1 en adelante.");
      return;
    }

    const items = picked.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }));

    setSubmitting(true);
    setError(null);
    try {
      await api.post("/orders", { customerId: customerId || undefined, items });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
    <form className="card new-order-form animate-in" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field-label" htmlFor="new-order-customer">
          Cliente
        </label>
        <CustomerPicker
          id="new-order-customer"
          customers={customers}
          value={customerId}
          onChange={setCustomerId}
          onRequestCreate={() => setShowCustomerForm(true)}
        />
      </div>

      <div className="new-order-lines">
        {lines.map((line, index) => (
          <div className="new-order-line" key={index}>
            <select
              className="select"
              value={line.productId}
              onChange={(e) => updateLine(index, { productId: e.target.value })}
            >
              <option value="">Elegir producto...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="1"
              className="input new-order-qty"
              value={line.quantity}
              onChange={(e) => updateLine(index, { quantity: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm new-order-remove"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1}
              aria-label="Quitar producto"
            >
              <IconX width={14} height={14} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost btn-sm" onClick={addLine} style={{ alignSelf: "flex-start" }}>
        <IconPlus width={14} height={14} />
        Agregar producto
      </button>

      {error && <p className="status-error" style={{ fontSize: 13 }}>{error}</p>}

      <div className="new-order-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creando..." : "Crear pedido"}
        </button>
      </div>
    </form>

    {showCustomerForm && (
      <CustomerForm
        onClose={() => setShowCustomerForm(false)}
        onSaved={(customer) => {
          setShowCustomerForm(false);
          setCustomers((prev) => [...prev, { ...customer, orderCount: 0, totalSpent: 0, pendingDebt: 0 }]);
          setCustomerId(customer.id);
        }}
      />
    )}
    </>
  );
}
