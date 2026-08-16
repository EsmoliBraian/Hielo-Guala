import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { CustomerForm } from "../components/CustomerForm";
import { OrderHistory } from "../components/OrderHistory";
import {
  IconAlertTriangle,
  IconBankTransfer,
  IconCash,
  IconChevronDown,
  IconClipboardList,
  IconPackage,
  IconPhone,
  IconPlus,
  IconTrendingUp,
  IconUsers,
  IconX,
} from "../components/icons";
import { Modal } from "../components/Modal";
import type { Customer, CustomerDetail } from "../types/api";

const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  DEBT: "Deuda",
  SIN_ESPECIFICAR: "Sin especificar",
};

const PAYMENT_METHOD_ICONS: Record<string, typeof IconCash> = {
  CASH: IconCash,
  TRANSFER: IconBankTransfer,
  DEBT: IconClipboardList,
};

function CustomerDetailPanel({ customerId }: { customerId: string }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await api.get<CustomerDetail>(`/customers/${customerId}`));
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSettleDebt(orderId: string) {
    setSettlingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/settle-debt`);
      await load();
    } finally {
      setSettlingId(null);
    }
  }

  if (loading || !detail) {
    return (
      <div className="card order-card-skeleton">
        <div className="skeleton" style={{ width: "40%" }} />
        <div className="skeleton" style={{ width: "70%" }} />
      </div>
    );
  }

  const { summary } = detail;
  const pendingDebts = detail.orders.filter((order) => order.sale?.paymentMethod === "DEBT" && !order.sale.debtSettledAt);

  return (
    <div className="customer-detail animate-in">
      {pendingDebts.length > 0 && (
        <div className="customer-debts">
          <h4>Deudas pendientes</h4>
          <ul className="customer-debts-list">
            {pendingDebts.map((order) => (
              <li key={order.id} className="customer-debt-row">
                <div className="customer-debt-info">
                  <span className="customer-debt-amount">{CURRENCY_FORMATTER.format(Number(order.sale!.totalAmount))}</span>
                  <span className="customer-debt-date">{DATE_FORMATTER.format(new Date(order.receivedAt))}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSettleDebt(order.id)}
                  disabled={settlingId === order.id}
                >
                  {settlingId === order.id ? "Guardando..." : "Marcar como pagada"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-tile-row">
        <div className="stat-tile stat-tile-sm">
          <span className="stat-tile-icon">
            <IconTrendingUp width={18} height={18} />
          </span>
          <div>
            <div className="stat-tile-label">Total gastado</div>
            <div className="stat-tile-value stat-tile-value-sm">{CURRENCY_FORMATTER.format(summary.totalSpent)}</div>
          </div>
        </div>
        <div className="stat-tile stat-tile-sm">
          <span className="stat-tile-icon">
            <IconPackage width={18} height={18} />
          </span>
          <div>
            <div className="stat-tile-label">Pedidos</div>
            <div className="stat-tile-value stat-tile-value-sm">
              {summary.deliveredCount} entregados{summary.cancelledCount > 0 ? ` · ${summary.cancelledCount} cancelados` : ""}
            </div>
          </div>
        </div>
        {summary.pendingDebt > 0 && (
          <div className="stat-tile stat-tile-sm stat-tile-debt">
            <span className="stat-tile-icon">
              <IconAlertTriangle width={18} height={18} />
            </span>
            <div>
              <div className="stat-tile-label">Deuda pendiente</div>
              <div className="stat-tile-value stat-tile-value-sm">{CURRENCY_FORMATTER.format(summary.pendingDebt)}</div>
            </div>
          </div>
        )}
        {summary.lastOrderAt && (
          <div className="stat-tile stat-tile-sm">
            <span className="stat-tile-icon">
              <IconPhone width={18} height={18} />
            </span>
            <div>
              <div className="stat-tile-label">Último pedido</div>
              <div className="stat-tile-value stat-tile-value-sm">{DATE_FORMATTER.format(new Date(summary.lastOrderAt))}</div>
            </div>
          </div>
        )}
      </div>

      {summary.byProduct.length > 0 && (
        <div className="customer-breakdown">
          <h4>Productos más pedidos</h4>
          <ul className="customer-breakdown-list">
            {summary.byProduct.map((p) => (
              <li key={p.productName}>
                <span>{p.productName}</span>
                <span className="customer-breakdown-value">{p.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.byPaymentMethod.length > 0 && (
        <div className="customer-breakdown">
          <h4>Por método de pago</h4>
          <ul className="customer-breakdown-list">
            {summary.byPaymentMethod.map(({ paymentMethod, revenue }) => {
              const Icon = PAYMENT_METHOD_ICONS[paymentMethod] ?? IconCash;
              return (
                <li key={paymentMethod}>
                  <span className="customer-breakdown-label">
                    <Icon width={14} height={14} />
                    {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}
                  </span>
                  <span className="customer-breakdown-value">{CURRENCY_FORMATTER.format(revenue)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h4>Pedidos de {detail.customer.name}</h4>
      <OrderHistory customerId={customerId} />
    </div>
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"asc" | "desc" | "debtors">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await api.get<Customer[]>("/customers");
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phones.some((p) => p.phone.includes(q)))
      : customers;
    if (viewMode === "debtors") base = base.filter((c) => c.pendingDebt > 0);

    return [...base].sort((a, b) =>
      viewMode === "debtors"
        ? b.pendingDebt - a.pendingDebt
        : viewMode === "asc"
          ? a.name.localeCompare(b.name, "es")
          : b.name.localeCompare(a.name, "es"),
    );
  }, [customers, search, viewMode]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      await loadCustomers();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p className="page-subtitle">Asociá teléfonos a un cliente para filtrar sus pedidos y ver sus métricas</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus width={16} height={16} />
          Nuevo cliente
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <select
            className="select"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "asc" | "desc" | "debtors")}
            aria-label="Ordenar o filtrar clientes"
          >
            <option value="asc">Nombre A-Z</option>
            <option value="desc">Nombre Z-A</option>
            <option value="debtors">Deudores</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="products-list">
          <div className="card order-card-skeleton">
            <div className="skeleton" style={{ width: "50%" }} />
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-error">
          <IconAlertTriangle width={18} height={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">
            <IconUsers width={24} height={24} />
          </span>
          <span className="empty-state-title">
            {customers.length === 0 ? "Todavía no cargaste clientes" : "Sin resultados"}
          </span>
          <span>Asociá el teléfono de WhatsApp de un cliente para empezar a ver sus métricas acá.</span>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="products-list">
          {filtered.map((customer) => {
            const isExpanded = expandedId === customer.id;
            return (
              <article key={customer.id} className="product-card animate-in">
                <div className="product-row">
                  <span className="customer-name">
                    {customer.pendingDebt > 0 && (
                      <span className="debtor-dot" title={`Debe ${CURRENCY_FORMATTER.format(customer.pendingDebt)}`} />
                    )}
                    {customer.name}
                  </span>
                  <div className="customer-phones">
                    {customer.phones.map((p) => (
                      <span key={p.id} className="phone-chip">
                        <IconPhone width={12} height={12} />
                        {p.phone}
                      </span>
                    ))}
                  </div>
                  <span className="customer-stat">
                    {customer.orderCount} pedido{customer.orderCount === 1 ? "" : "s"}
                  </span>
                  <span className="customer-stat customer-stat-strong">
                    {CURRENCY_FORMATTER.format(customer.totalSpent)}
                  </span>
                  <div className="product-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditingCustomer(customer)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteTarget(customer)}
                    >
                      <IconX width={14} height={14} />
                      Eliminar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                    >
                      Métricas y pedidos
                      <IconChevronDown
                        width={15}
                        height={15}
                        className={`chevron${isExpanded ? " chevron-open" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                {isExpanded && <CustomerDetailPanel customerId={customer.id} />}
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadCustomers();
          }}
        />
      )}

      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={() => {
            setEditingCustomer(null);
            loadCustomers();
          }}
        />
      )}

      {deleteTarget && (
        <Modal title="Eliminar cliente" onClose={() => !deleting && setDeleteTarget(null)}>
          <p className="modal-summary">{deleteTarget.name}</p>
          <p>
            Esto va a borrar el cliente y sus teléfonos asociados. Los pedidos ya hechos no se borran, solo dejan de
            estar vinculados a este cliente. No se puede deshacer.
          </p>
          <div className="new-order-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Volver
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Eliminando..." : "Sí, eliminar cliente"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
