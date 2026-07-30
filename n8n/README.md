# Workflow de n8n — Integración WhatsApp

Conecta el webhook de WhatsApp Cloud API con el backend de Hielo Guala: recibe el mensaje, crea el pedido, responde por WhatsApp y le avisa al backend si el bot pudo confirmar.

## 1. Requisitos previos (Meta / WhatsApp Cloud API)

1. Crear una app en [Meta for Developers](https://developers.facebook.com/) con el producto **WhatsApp**.
2. Desde el panel de WhatsApp > API Setup, conseguir:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Token de acceso temporal o permanente** → `WHATSAPP_CLOUD_API_TOKEN`
3. Definir un **Verify Token** propio (cualquier string secreto que inventes) → `WHATSAPP_VERIFY_TOKEN`. Meta lo usa solo para el handshake de verificación del webhook.
4. Completar esos 3 valores en el `.env` de la raíz del proyecto (además de `WHATSAPP_VERIFY_TOKEN`, que ya tiene un default de ejemplo — cambialo).

## 2. Levantar n8n

```bash
docker compose up -d n8n
```

Entrar a http://localhost:5678 (usuario/contraseña definidos en `N8N_BASIC_AUTH_USER`/`N8N_BASIC_AUTH_PASSWORD` del `.env`).

## 3. Importar el workflow

`workflows/hielo-guala-whatsapp.json` es un export de n8n listo para importar (**Workflows → Import from File**). Como el formato interno de los nodos puede variar levemente entre versiones de n8n, si algún nodo aparece marcado con un ícono de advertencia al importar, abrilo y comparalo con la lista de nodos de la sección 4 — es rápido de corregir a mano.

Después de importar:

- El workflow usa `{{$env.NOMBRE_VARIABLE}}` para leer `BACKEND_URL`, `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_VERIFY_TOKEN` — ya están inyectadas como variables de entorno del contenedor `n8n` en `docker-compose.yml`, no hace falta tocarlas en el editor.
- Activar el workflow (toggle "Active" arriba a la derecha).

## 4. Estructura del workflow (para armarlo a mano o verificarlo)

**Rama A — verificación del webhook (Meta hace un GET una sola vez al configurar):**

1. **Webhook** (GET, path `hielo-guala-whatsapp`, response mode "Using Respond to Webhook Node")
2. **IF**: `{{$json.query["hub.verify_token"]}}` == `{{$env.WHATSAPP_VERIFY_TOKEN}}`
3. Rama verdadera → **Respond to Webhook**: texto plano, body `{{$json.query["hub.challenge"]}}`
4. Rama falsa → **Respond to Webhook**: texto plano "Forbidden", código 403

**Rama B — mensaje entrante (cada pedido por WhatsApp):**

1. **Webhook** (POST, mismo path, response mode "Immediately" — así WhatsApp recibe el 200 al toque y no reintenta)
2. **IF**: ¿existe `body.entry[0].changes[0].value.messages`? (WhatsApp también manda eventos de "leído"/estado que hay que ignorar)
3. Rama falsa → no hacer nada (NoOp)
4. Rama verdadera → **Edit Fields (Set)**: extraer `customerPhone`, `rawMessage`, `waMessageId`, `receivedAt` del mensaje
5. **HTTP Request** → `POST {{$env.BACKEND_URL}}/api/whatsapp/orders` con esos 4 campos
6. **Edit Fields (Set)**: armar el texto de confirmación a partir de la respuesta (avisa si hubo ítems no reconocidos)
7. **HTTP Request** → `POST https://graph.facebook.com/v20.0/{{$env.WHATSAPP_PHONE_NUMBER_ID}}/messages` (header `Authorization: Bearer {{$env.WHATSAPP_CLOUD_API_TOKEN}}`), con "On Error" configurado como **"Continue"** (no "Continue using error output" — esa variante con doble salida no se importó de forma confiable en las pruebas)
8. **IF**: `{{$json.error !== undefined}}` — si el request anterior falló, `$json` queda como `{ error: ... }` en vez de la respuesta de Meta
9. Rama falsa (envío OK) → **HTTP Request** → `POST {{$env.BACKEND_URL}}/api/whatsapp/orders/{orderId}/bot-answered` con `{"success": true}`
10. Rama verdadera (falló) → mismo endpoint con `{"success": false, "error": "..."}`

## 5. Probar sin un número de WhatsApp real

- **Handshake de verificación**:
  ```bash
  curl "http://localhost:5678/webhook/hielo-guala-whatsapp?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=12345"
  ```
  Debería devolver `12345`.

- **Mensaje entrante simulado** (con la forma real que manda Meta):
  ```bash
  curl -X POST http://localhost:5678/webhook/hielo-guala-whatsapp \
    -H "Content-Type: application/json" \
    -d '{
      "entry": [{
        "changes": [{
          "value": {
            "messages": [{
              "from": "5491122334455",
              "id": "wamid.TEST123",
              "timestamp": "1700000000",
              "text": { "body": "3bolsitas y 1 bolson" }
            }]
          }
        }]
      }]
    }'
  ```
  El pedido debería aparecer en el tablero (`http://localhost:5173/orders`). El paso de enviar la respuesta por WhatsApp va a fallar si `WHATSAPP_CLOUD_API_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` no son reales — es esperable en este modo de prueba; el pedido igual queda creado.

## 6. Producción

Solo n8n necesita ser alcanzable por Meta desde internet (URL pública HTTPS). El backend, la base de datos y el frontend pueden quedar en la red interna. En desarrollo local, usar un túnel (ngrok, Cloudflare Tunnel) apuntando al puerto 5678; en producción, un reverse proxy con HTTPS hacia el mismo puerto.
