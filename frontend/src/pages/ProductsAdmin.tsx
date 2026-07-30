import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AliasManager } from "../components/AliasManager";
import { IconChevronDown, IconTag } from "../components/icons";
import type { Product } from "../types/api";

export function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; price: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    const data = await api.get<Product[]>("/products?includeInactive=true");
    setProducts(data);
    setDrafts(
      Object.fromEntries(data.map((p) => [p.id, { name: p.name, price: p.price }])),
    );
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function updateDraft(id: string, field: "name" | "price", value: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSave(product: Product) {
    const draft = drafts[product.id];
    setSavingId(product.id);
    try {
      const updated = await api.patch<Product>(`/products/${product.id}`, {
        name: draft.name,
        price: Number(draft.price),
      });
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...updated } : p)));
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActive(product: Product) {
    if (product.active) {
      await api.delete(`/products/${product.id}`);
    } else {
      await api.patch(`/products/${product.id}`, { active: true });
    }
    await loadProducts();
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Productos y precios</h1>
          <p className="page-subtitle">Editá precios y las palabras que reconoce el parser de WhatsApp</p>
        </div>
      </div>

      {loading ? (
        <div className="products-list">
          <div className="card order-card-skeleton">
            <div className="skeleton" style={{ width: "60%" }} />
            <div className="skeleton" style={{ width: "40%" }} />
          </div>
          <div className="card order-card-skeleton">
            <div className="skeleton" style={{ width: "60%" }} />
            <div className="skeleton" style={{ width: "40%" }} />
          </div>
        </div>
      ) : (
        <div className="products-list">
          {products.map((product) => {
            const isExpanded = expandedId === product.id;
            return (
              <article
                key={product.id}
                className={`product-card animate-in${product.active ? "" : " product-card-inactive"}`}
              >
                <div className="product-row">
                  <span className="product-weight">{product.weightKg}kg</span>
                  <input
                    type="text"
                    className="input product-name-input"
                    value={drafts[product.id]?.name ?? ""}
                    onChange={(e) => updateDraft(product.id, "name", e.target.value)}
                  />
                  <div className="input-group product-price-group">
                    <span className="input-group-prefix">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={drafts[product.id]?.price ?? ""}
                      onChange={(e) => updateDraft(product.id, "price", e.target.value)}
                    />
                  </div>
                  {!product.active && <span className="badge badge-neutral">Inactivo</span>}
                  <div className="product-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSave(product)}
                      disabled={savingId === product.id}
                    >
                      {savingId === product.id ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggleActive(product)}
                    >
                      {product.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(isExpanded ? null : product.id)}
                    >
                      <IconTag width={15} height={15} />
                      Alias
                      <IconChevronDown
                        width={15}
                        height={15}
                        className={`chevron${isExpanded ? " chevron-open" : ""}`}
                      />
                    </button>
                  </div>
                </div>
                {isExpanded && <AliasManager productId={product.id} />}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
