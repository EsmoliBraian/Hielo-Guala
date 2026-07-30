import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AliasManager } from "../components/AliasManager";
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

  if (loading) return <p className="status-message">Cargando productos...</p>;

  return (
    <section>
      <h1>Productos y precios</h1>
      <div className="products-list">
        {products.map((product) => (
          <article key={product.id} className={`product-card${product.active ? "" : " product-card-inactive"}`}>
            <div className="product-row">
              <span className="product-weight">{product.weightKg}kg</span>
              <input
                type="text"
                className="product-name-input"
                value={drafts[product.id]?.name ?? ""}
                onChange={(e) => updateDraft(product.id, "name", e.target.value)}
              />
              <span className="product-price-prefix">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="product-price-input"
                value={drafts[product.id]?.price ?? ""}
                onChange={(e) => updateDraft(product.id, "price", e.target.value)}
              />
              <button type="button" onClick={() => handleSave(product)} disabled={savingId === product.id}>
                {savingId === product.id ? "Guardando..." : "Guardar"}
              </button>
              <button type="button" className="product-toggle" onClick={() => handleToggleActive(product)}>
                {product.active ? "Desactivar" : "Activar"}
              </button>
              <button
                type="button"
                className="product-toggle"
                onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
              >
                {expandedId === product.id ? "Ocultar alias" : "Ver alias"}
              </button>
            </div>
            {expandedId === product.id && <AliasManager productId={product.id} />}
          </article>
        ))}
      </div>
    </section>
  );
}
