# Despliegue en producción

## Servidor actual

- Hetzner CX23 (2 vCPU, 4GB RAM, 40GB disco) — Helsinki
- IP pública: `65.21.250.228`
- Acceso SSH: `ssh -i ~/.ssh/hielo_guala_vps root@65.21.250.228`
- Repo clonado en `/opt/hielo-guala`
- HTTPS: sin dominio propio, usamos [sslip.io](https://sslip.io) (subdominios "mágicos" que resuelven directo a la IP del servidor, ej. `65-21-250-228.sslip.io`) + Caddy como reverse proxy delante de la app y de n8n, que consigue certificados Let's Encrypt automáticos. Ver `Caddyfile` en la raíz del repo.

## URLs

| Servicio | URL |
|---|---|
| App (tablero de pedidos) | https://`${APP_DOMAIN}`/ (ej. `https://65-21-250-228.sslip.io/`) |
| n8n | https://`${N8N_HOST}`/ (ej. `https://n8n.65-21-250-228.sslip.io/`) |
| Evolution API (admin) | apagado — ver nota abajo |

Backend (puerto 3000) y las bases de datos **no** están expuestas a internet — solo accesibles dentro de la red interna de Docker. Frontend y n8n tampoco exponen sus puertos directamente: todo el tráfico entra por Caddy (80/443), que hace de único punto de entrada HTTPS. El firewall (`ufw`) solo deja pasar SSH, 80 y 443.

**Evolution API está detenido** (`docker compose stop evolution-api evolution-postgres evolution-redis`, 2026-08-02) — la vía oficial (Meta Cloud API) ya está funcionando en producción, así que esto quedó sin uso. Los contenedores y sus datos siguen ahí por si hiciera falta volver atrás, simplemente no arrancan solos (`restart: unless-stopped` respeta el stop manual). Para reactivarlos: `docker compose -f docker-compose.prod.yml up -d evolution-api evolution-postgres evolution-redis` y reabrir el puerto 8080 (`ufw allow 8080/tcp`).

## Diferencias con el entorno de desarrollo

`docker-compose.prod.yml` (no `docker-compose.yml`) es el que se usa acá:
- Frontend: build estático de Vite servido por nginx (no el dev server), que además hace de proxy de `/api` hacia el backend — reemplaza al proxy de Vite.
- Backend: corre el JS compilado (`Dockerfile.prod`) en vez de `tsx watch`.
- Secretos reales en `/opt/hielo-guala/.env` (permisos `600`, nunca en git) — generados una sola vez, no son los `changeme` de `.env.example`.

## Redesplegar después de un cambio

```bash
ssh -i ~/.ssh/hielo_guala_vps root@65.21.250.228
cd /opt/hielo-guala
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## HTTPS (Caddy + sslip.io) — setup inicial, ya hecho en este servidor

Solo hace falta si se recrea el servidor desde cero:

1. Agregar al `.env` del servidor: `APP_DOMAIN=65-21-250-228.sslip.io` y `N8N_HOST=n8n.65-21-250-228.sslip.io` (con guiones en vez de puntos en la IP), y `WEBHOOK_URL=https://n8n.65-21-250-228.sslip.io/`.
2. Abrir el puerto 443: `ufw allow 443/tcp`.
3. `docker compose -f docker-compose.prod.yml up -d --build` — Caddy pide los certificados solo la primera vez que alguien pega contra cada dominio (puede tardar unos segundos).

Meta exige HTTPS para la URL del webhook de WhatsApp — por eso esto es un requisito, no algo cosmético.

## Correr el seed de productos (primera vez, o para resetear)

`tsx` no está en la imagen de producción (es una devDependency, no se instala ahí a propósito). Usar `npx` para bajarlo al vuelo:

```bash
docker compose -f docker-compose.prod.yml exec backend npx --yes tsx prisma/seed.ts
```

## Backups

`scripts/backup-db.sh` corre por cron todos los días a las 06:00 UTC (03:00 Argentina), hace `pg_dump` de la base y borra los backups de más de 14 días. Quedan en `/opt/hielo-guala/backups/` (no versionado, están en `.gitignore`).

Setup (ya hecho en este servidor, solo hace falta si se recrea desde cero):

```bash
chmod +x /opt/hielo-guala/scripts/backup-db.sh
crontab -l 2>/dev/null | { cat; echo "0 6 * * * /opt/hielo-guala/scripts/backup-db.sh >> /opt/hielo-guala/backups/backup.log 2>&1"; } | crontab -
```

Restaurar un backup:

```bash
cat backups/hielo_guala-XXXXXXXX-XXXXXX.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB>
```

## Pendiente

- **Token de WhatsApp permanente**: hoy `WHATSAPP_CLOUD_API_TOKEN` es un token temporal (~24hs) generado a mano desde Meta for Developers. Hay que reemplazarlo por un token de Usuario del Sistema (no vence), lo cual requiere completar antes la verificación del negocio en Meta Business.
- **Verificación del negocio en Meta**: sin esto, Meta limita cuántos clientes distintos se pueden mensajear por día (arranca bajo). Necesario para escalar.
- **Dominio propio**: si en algún momento se compra uno, es solo cambiar `APP_DOMAIN`/`N8N_HOST` en el `.env` del servidor y correr `up -d` de nuevo — Caddy se encarga del certificado nuevo solo.
