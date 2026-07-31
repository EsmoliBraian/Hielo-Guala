import type { Customer } from "../types/api";

interface CustomerPickerProps {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  onRequestCreate: () => void;
  /** Label for the empty/placeholder option. */
  noneLabel?: string;
  id?: string;
}

const CREATE_NEW_VALUE = "__new__";

export function CustomerPicker({
  customers,
  value,
  onChange,
  onRequestCreate,
  noneLabel = "Mostrador (sin cliente)",
  id,
}: CustomerPickerProps) {
  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => {
        if (e.target.value === CREATE_NEW_VALUE) {
          onRequestCreate();
          return;
        }
        onChange(e.target.value);
      }}
    >
      <option value="">{noneLabel}</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
          {customer.phones[0] ? ` — ${customer.phones[0].phone}` : ""}
        </option>
      ))}
      <option value={CREATE_NEW_VALUE}>+ Crear cliente nuevo...</option>
    </select>
  );
}
