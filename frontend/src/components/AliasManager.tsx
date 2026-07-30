import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ProductAlias } from "../types/api";

export function AliasManager({ productId }: { productId: string }) {
  const [aliases, setAliases] = useState<ProductAlias[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAliases() {
    setLoading(true);
    try {
      const data = await api.get<ProductAlias[]>(`/products/${productId}/aliases`);
      setAliases(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAliases();
  }, [productId]);

  async function handleAdd() {
    const alias = newAlias.trim();
    if (!alias) return;
    setError(null);
    try {
      await api.post("/aliases", { productId, alias });
      setNewAlias("");
      await loadAliases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el alias");
    }
  }

  async function handleRemove(id: string) {
    await api.delete(`/aliases/${id}`);
    setAliases((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) return <p className="status-message">Cargando alias...</p>;

  return (
    <div className="alias-manager">
      <div className="alias-chips">
        {aliases.map((alias) => (
          <span key={alias.id} className="alias-chip">
            {alias.alias}
            <button type="button" onClick={() => handleRemove(alias.id)} aria-label={`Quitar ${alias.alias}`}>
              ×
            </button>
          </span>
        ))}
        {aliases.length === 0 && <span className="status-message">Sin alias todavía.</span>}
      </div>
      <div className="alias-add">
        <input
          type="text"
          placeholder='Ej: "hielo chico"'
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button type="button" onClick={handleAdd}>
          Agregar
        </button>
      </div>
      {error && <p className="status-error">{error}</p>}
    </div>
  );
}
