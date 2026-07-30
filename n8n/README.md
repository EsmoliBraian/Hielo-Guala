# Workflow de n8n — Integración WhatsApp

Conecta WhatsApp con el backend de Hielo Guala: recibe el mensaje, crea el pedido, responde por WhatsApp y le avisa al backend si el bot pudo confirmar. Hay dos formas de conectar WhatsApp — elegí una:

| | **A. WhatsApp Cloud API** (oficial) | **B. Evolution API** (no oficial) |
|---|---|---|
| Cómo se conecta | Cuenta de Meta Business verificada | Escaneando un QR con tu WhatsApp, como WhatsApp Web |
| Riesgo | Ninguno — es la vía sancionada por Meta | **Meta puede banear el número** si detecta uso automatizado |
| Setup | Puede demorar (verificación de Meta) | Rápido, anda en minutos |
| Recomendado para | Producción / negocio real a largo plazo | Probar todo el flujo ya, o mientras Meta destraba la verificación |

Las dos usan el mismo backend sin ningún cambio — solo cambia cómo el mensaje entra a n8n y cómo se manda la respuesta.

---

## Opción A: WhatsApp Cloud API (oficial)

### A.1 Requisitos previos (Meta)

1. Crear una app en [Meta for Developers](https://developers.facebook.com/) con el producto **WhatsApp**.
2. Desde el panel de WhatsApp > API Setup, conseguir:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Token de acceso temporal o permanente** → `WHATSAPP_CLOUD_API_TOKEN`
3. Definir un **Verify Token** propio (cualquier string secreto que inventes) → `WHATSAPP_VERIFY_TOKEN`.
4. Completar esos 3 valores en el `.env` de la raíz del proyecto.

### A.2 Importar el workflow

`workflows/hielo-guala-whatsapp.json` → **Workflows → Import from File** en n8n (http://localhost:5678). Activalo con el toggle "Active".

### A.3 Estructura (para armarlo a mano o verificarlo)

**Rama A — verificación del webhook (Meta hace un GET una sola vez al configurar):**

1. **Webhook** (GET, path `hielo-guala-whatsapp`, response mode "Using Respond to Webhook Node")
2. **IF**: `{{$json.query["hub.verify_token"]}}` == `{{$env.WHATSAPP_VERIFY_TOKEN}}`
3. Rama verdadera → **Respond to Webhook**: texto plano, body `{{$json.query["hub.challenge"]}}`
4. Rama falsa → **Respond to Webhook**: texto plano "Forbidden", código 403

**Rama B — mensaje entrante (cada pedido por WhatsApp):**

1. **Webhook** (POST, mismo path, response mode "Immediately")
2. **IF**: ¿existe `body.entry[0].changes[0].value.messages`?
3. Rama falsa → NoOp
4. Rama verdadera → **Edit Fields (Set)**: extraer `customerPhone`, `rawMessage`, `waMessageId`, `receivedAt`
5. **HTTP Request** → `POST {{$env.BACKEND_URL}}/api/whatsapp/orders`
6. **Edit Fields (Set)**: armar el texto de confirmación
7. **HTTP Request** → `POST https://graph.facebook.com/v20.0/{{$env.WHATSAPP_PHONE_NUMBER_ID}}/messages` (header `Authorization: Bearer {{$env.WHATSAPP_CLOUD_API_TOKEN}}`). **"On Error" = "Continue"** en la pestaña Settings del nodo (no dentro de Parameters — ahí no lo respeta).
8. **IF**: `{{$json.error !== undefined}}`
9. Rama falsa (OK) → **HTTP Request** → `POST {{$env.BACKEND_URL}}/api/whatsapp/orders/{orderId}/bot-answered` con `{"success": true}`
10. Rama verdadera (falló) → mismo endpoint con `{"success": false, "error": "..."}`

### A.4 Probar sin un número real

```bash
curl "http://localhost:5678/webhook/hielo-guala-whatsapp?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=12345"
# debe devolver: 12345

curl -X POST http://localhost:5678/webhook/hielo-guala-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"messages":[{"from":"5491122334455","id":"wamid.TEST123","timestamp":"1700000000","text":{"body":"3bolsitas y 1 bolson"}}]}}]}]}'
```

El pedido debería aparecer en `http://localhost:5173/orders`. El envío por WhatsApp va a fallar sin credenciales reales — es esperable, el pedido igual queda creado.

### A.5 Producción

Solo n8n necesita ser alcanzable por Meta desde internet (URL pública HTTPS). Túnel (ngrok/Cloudflare Tunnel) en dev, reverse proxy con HTTPS en producción.

---

## Opción B: Evolution API (no oficial, conexión por QR)

⚠️ **Antes de usarla**: es un cliente no oficial de WhatsApp (basado en ingeniería inversa de WhatsApp Web, vía [Baileys](https://github.com/WhiskeySockets/Baileys)). Meta puede banear el número si detecta patrones de envío automatizado (mucho volumen, respuestas muy rápidas y repetitivas, etc.). Para probar el flujo completo sin arriesgar tu número de negocio, usá un número de WhatsApp descartable primero.

### B.1 Levantar los servicios

```bash
docker compose up -d evolution-postgres evolution-redis evolution-api evolution-manager
```

Esto levanta:
- `evolution-api` (puerto 8080): el servidor que habla con WhatsApp.
- `evolution-manager` (puerto 8081): UI web para crear la instancia y ver el QR sin usar curl.

Revisá que las variables `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `EVOLUTION_POSTGRES_*` estén completas en tu `.env` (tienen defaults de ejemplo en `.env.example`).

### B.2 Crear la instancia y escanear el QR

1. Entrar a **http://localhost:8081** (Evolution Manager).
2. Conectarse al servidor: URL `http://localhost:8080`, API Key = el valor de `EVOLUTION_API_KEY` de tu `.env`.
3. Crear una instancia nueva con el nombre que pusiste en `EVOLUTION_INSTANCE_NAME` (por defecto `hielo-guala`).
4. Te va a mostrar un código QR — escanealo desde el WhatsApp que vas a usar (**Configuración → Dispositivos vinculados → Vincular un dispositivo**).
5. Una vez conectado, el estado de la instancia pasa a "open"/"conectado".

El webhook ya queda configurado automáticamente hacia n8n (`WEBHOOK_GLOBAL_URL` en `docker-compose.yml` apunta a `http://n8n:5678/webhook/hielo-guala-evolution`), no hace falta tocar nada ahí.

### B.3 Importar el workflow

`workflows/hielo-guala-whatsapp-evolution.json` → **Workflows → Import from File** en n8n. Activalo con el toggle "Active".

### B.4 Estructura del workflow

1. **Webhook** (POST, path `hielo-guala-evolution`, response mode "Immediately")
2. **IF**: `{{$json.body.event === 'messages.upsert' && $json.body.data?.key?.fromMe === false && Boolean($json.body.data?.message)}}` — filtra eventos que no son un mensaje nuevo entrante (ej. mensajes que mandamos nosotros mismos, que también llegan por el mismo webhook)
3. Rama falsa → NoOp
4. Rama verdadera → **Edit Fields (Set)**: `customerPhone` (de `data.key.remoteJid`, sacando el sufijo `@s.whatsapp.net`), `rawMessage`, `waMessageId`, `receivedAt`
5. **HTTP Request** → `POST {{$env.BACKEND_URL}}/api/whatsapp/orders` (idéntico a la Opción A — el backend no sabe ni le importa qué proveedor de WhatsApp se usó)
6. **Edit Fields (Set)**: armar el texto de confirmación
7. **HTTP Request** → `POST {{$env.EVOLUTION_API_URL}}/message/sendText/{{$env.EVOLUTION_INSTANCE_NAME}}` (header `apikey: {{$env.EVOLUTION_API_KEY}}`), body `{"number": "...", "text": "..."}`. **"On Error" = "Continue"** en Settings del nodo.
8. **IF**: `{{$json.error !== undefined}}`
9. Rama falsa (OK) → confirma `bot-answered` con `{"success": true}`
10. Rama verdadera (falló) → confirma con `{"success": false, "error": "..."}`

### B.5 Probar

Mandate un mensaje real de WhatsApp al número que vinculaste (ej. `"2 bolsitas y 1 bolson"`) y confirmá que aparece en `http://localhost:5173/orders` y que te responde por WhatsApp.

Para simular sin mandar un WhatsApp real, el payload que llega al webhook tiene esta forma:

```bash
curl -X POST http://localhost:5678/webhook/hielo-guala-evolution \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "hielo-guala",
    "data": {
      "key": { "id": "TEST123", "fromMe": false, "remoteJid": "5491122334455@s.whatsapp.net" },
      "message": { "conversation": "3bolsitas y 1 bolson" },
      "messageTimestamp": 1700000000
    }
  }'
```

### B.6 Migrar a la Opción A más adelante

El backend y el frontend no cambian en absoluto — ambos workflows llaman a los mismos endpoints. Cuando Meta te habilite la cuenta, activá el workflow de la Opción A y desactivá el de la Opción B. Los dos pueden convivir importados en n8n (usan paths distintos), pero no conviene dejarlos activos al mismo tiempo: si el mismo cliente te escribe por el número conectado a ambos proveedores, terminarías respondiéndole dos veces.
