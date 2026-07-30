import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ProductAlias } from "../types/api";
import { IconPlus, IconX } from "./icons";

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

  if (loading) return <p className="status-message status-message-inline">Cargando alias...</p>;

  return (
    <div className="alias-manager">
      <div className="alias-chips">
        {aliases.map((alias) => (
          <span key={alias.id} className="alias-chip">
            {alias.alias}
            <button type="button" onClick={() => handleRemove(alias.id)} aria-label={`Quitar ${alias.alias}`}>
              <IconX width={12} height={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        {aliases.length === 0 && (
          <span className="status-message status-message-inline">Sin alias todavía.</span>
        )}
      </div>
      <div className="alias-add">
        <input
          type="text"
          className="input"
          placeholder='Ej: "hielo chico"'
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button type="button" className="btn btn-secondary" onClick={handleAdd}>
          <IconPlus width={15} height={15} />
          Agregar
        </button>
      </div>
      {error && (
        <p className="status-error" style={{ marginTop: 8, fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  );
}
