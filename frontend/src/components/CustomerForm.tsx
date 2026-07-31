import { useState } from "react";
import { api } from "../api/client";
import type { Customer, CustomerRecord } from "../types/api";
import { IconPlus, IconX } from "./icons";
import { Modal } from "./Modal";

interface CustomerFormProps {
  customer?: Customer;
  onSaved: (customer: CustomerRecord) => void;
  onClose: () => void;
}

export function CustomerForm({ customer, onSaved, onClose }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [phones, setPhones] = useState<string[]>(
    customer?.phones.map((p) => p.phone) ?? [""],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePhone(index: number, value: string) {
    setPhones((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function addPhone() {
    setPhones((prev) => [...prev, ""]);
  }

  function removePhone(index: number) {
    setPhones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const cleanPhones = phones.map((p) => p.trim()).filter(Boolean);
    if (cleanPhones.length === 0) {
      setError("Agregá al menos un número de teléfono.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = { name: name.trim(), notes: notes.trim() || null, phones: cleanPhones };
      const saved = customer
        ? await api.patch<CustomerRecord>(`/customers/${customer.id}`, payload)
        : await api.post<CustomerRecord>("/customers", payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={customer ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <form className="new-order-form" onSubmit={handleSubmit} style={{ padding: 0, margin: 0 }}>
        <div className="field">
          <label className="field-label" htmlFor="customer-name">
            Nombre
          </label>
          <input
            id="customer-name"
            type="text"
            className="input"
            placeholder="Ej: Juan Pérez"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Teléfonos (WhatsApp)</label>
          <div className="new-order-lines">
            {phones.map((phone, index) => (
              <div className="new-order-line" key={index}>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: 5491122334455"
                  value={phone}
                  onChange={(e) => updatePhone(index, e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm new-order-remove"
                  onClick={() => removePhone(index)}
                  disabled={phones.length === 1}
                  aria-label="Quitar teléfono"
                >
                  <IconX width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addPhone} style={{ alignSelf: "flex-start" }}>
            <IconPlus width={14} height={14} />
            Agregar teléfono
          </button>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="customer-notes">
            Notas (opcional)
          </label>
          <input
            id="customer-notes"
            type="text"
            className="input"
            placeholder="Ej: barrio norte, siempre paga por transferencia"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="new-order-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
