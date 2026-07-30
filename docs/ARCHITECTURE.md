# Arquitectura — Hielo Guala

## Flujo general

```
Cliente (WhatsApp) --texto--> WhatsApp Cloud API --webhook--> n8n
                                                                 |
                                                                 v
                                                   backend (Express + Prisma)
                                                     - parsea el pedido
                                                     - lo guarda (Order + OrderItem)
                                                     - devuelve texto de confirmación
                                                                 |
                                                                 v
                                              n8n envía la confirmación por WhatsApp Cloud API
                                                                 |
                                                                 v
                                        n8n avisa al backend si el bot respondió con éxito

Frontend (React) <--HTTP--> backend
  - Tablero de pedidos pendientes, ordenados FIFO por receivedAt
  - Checklist "Entregado" -> genera Sale + SaleItem (snapshot de precio)
  - Administración de productos/precios y alias
  - Métricas de ventas
```

## Principios de diseño

- **El pedido nunca se pierde**: si el parser no reconoce un fragmento del texto, se guarda igual como `OrderItem` con `matched:false` para revisión manual, en vez de descartar el pedido.
- **Sale es inmutable**: se separa de `Order`/`OrderItem` y guarda un snapshot de nombre/precio del producto al momento de la entrega, para que cambios futuros de precios no distorsionen las métricas históricas.
- **Idempotencia**: `Order.waMessageId` es único — si WhatsApp reintenta el envío del webhook, no se duplica el pedido.
- **Soft-delete de productos**: un producto nunca se borra si ya fue referenciado en ventas históricas; se desactiva (`active:false`).
- **Seguridad de red**: solo n8n necesita URL pública (webhook de WhatsApp); el backend queda en la red interna de Docker.

## Modelo de datos

Ver `backend/prisma/schema.prisma` (fuente de verdad). Entidades: `Product`, `ProductAlias`, `Order`, `OrderItem`, `Sale`, `SaleItem`.

## Ver también

- [PARSER_RULES.md](PARSER_RULES.md) — reglas del parser de texto libre de WhatsApp.
