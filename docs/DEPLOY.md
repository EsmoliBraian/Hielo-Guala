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
| Evolution API (admin) | http://65.21.250.228:8080/ (requiere header `apikey`, sigue sin HTTPS — no expuesto a webhooks externos que lo requieran) |

Backend (puerto 3000) y las bases de datos **no** están expuestas a internet — solo accesibles dentro de la red interna de Docker. Frontend y n8n tampoco exponen sus puertos directamente: todo el tráfico entra por Caddy (80/443), que hace de único punto de entrada HTTPS. El firewall (`ufw`) deja pasar SSH, 80, 443 y 8080.

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

## Pendiente

- **Backups**: los volúmenes de Postgres (`pg_data`, `evolution_pg_data`) no tienen backup automático todavía.
- **Dominio propio**: si en algún momento se compra uno, es solo cambiar `APP_DOMAIN`/`N8N_HOST` en el `.env` del servidor y correr `up -d` de nuevo — Caddy se encarga del certificado nuevo solo.
