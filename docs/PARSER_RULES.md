# Reglas del parser de pedidos

Implementado en `backend/src/parser/orderParser.ts`. Es una función pura basada en reglas (regex/keywords), sin NLP/ML.

## Pipeline

1. **Normalizar**: minúsculas, quitar acentos (`bolsón` → `bolson`), colapsar espacios, recortar puntuación.
2. **Segmentar**: separar por conectores — `" y "`, `,`, `+`, `" mas "`, saltos de línea.
   - `"3bolsitas y 1 bolson"` → `["3bolsitas", "1 bolson"]`
3. **Extraer cantidad** por segmento: dígitos al inicio (`^\d+`, funciona pegado: `3bolsitas`) o números en palabras (`uno/una/dos/tres/.../diez`). Si no hay cantidad explícita, se asume `1`.
4. **Matchear el resto del texto** contra la tabla de alias (`ProductAlias`, editable desde la app):
   - Match exacto primero.
   - Luego sin plural (se saca la `s` final).
   - Luego contains/keyword, priorizando el alias más largo (para que `"bolsa de melin"` gane sobre `"bolsa"`).
   - Fallback: regex directo `/(\d+)\s?kg/` mapeado al `weightKg` del producto.
5. **Fragmento no reconocido** → se guarda igual como `OrderItem { productId: null, matched: false, rawFragment }`. El pedido se crea de todas formas.

## Alias iniciales (seed)

| Producto | Alias |
|---|---|
| Bolsa 2kg | `bolsita`, `bolsitas`, `hielo chico` |
| Bolsa 3kg | `bolsa de melin`, `melin`, `bolsa` (fallback genérico) |
| Bolsa 10kg | `bolson`, `bolsón`, `hielo grande` |

Todos editables desde la pantalla de administración de productos (M5), sin tocar código.

## Casos de ejemplo (cubiertos por tests unitarios)

- `"3bolsitas y 1 bolson"` → `[{2kg, x3}, {10kg, x1}]`
- `"2 bolsas de melin y una bolsita"` → `[{3kg, x2}, {2kg, x1}]`
- `"dame 5 hielos chicos"` → `[{2kg, x5}]`
- `"hola"` → `[]`, pedido creado sin ítems, queda para revisión manual

## Fuera de alcance (fase futura)

- Cantidades fraccionarias ("media bolsa").
- Defaults basados en historial del cliente ("el de siempre").
- NLP/ML — se prioriza un enfoque simple y auditable sobre uno "inteligente".
