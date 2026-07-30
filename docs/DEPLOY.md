# Despliegue en producción

## Servidor actual

- Hetzner CX23 (2 vCPU, 4GB RAM, 40GB disco) — Helsinki
- IP pública: `65.21.250.228` (sin dominio todavía — HTTP plano, no HTTPS)
- Acceso SSH: `ssh -i ~/.ssh/hielo_guala_vps root@65.21.250.228`
- Repo clonado en `/opt/hielo-guala`

## URLs

| Servicio | URL |
|---|---|
| App (tablero de pedidos) | http://65.21.250.228/ |
| n8n | http://65.21.250.228:5678/ |
| Evolution API (admin) | http://65.21.250.228:8080/ (requiere header `apikey`) |

Backend (puerto 3000) y las bases de datos **no** están expuestas a internet — solo accesibles dentro de la red interna de Docker. El firewall (`ufw`) solo deja pasar SSH, 80, 5678 y 8080.

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

## Correr el seed de productos (primera vez, o para resetear)

`tsx` no está en la imagen de producción (es una devDependency, no se instala ahí a propósito). Usar `npx` para bajarlo al vuelo:

```bash
docker compose -f docker-compose.prod.yml exec backend npx --yes tsx prisma/seed.ts
```

## Pendiente

- **WhatsApp**: falta importar el workflow de n8n (`n8n/workflows/hielo-guala-whatsapp-evolution.json`) y vincular el número acá — se hace igual que en local, apuntando a `http://65.21.250.228:5678` y `http://65.21.250.228:8080`.
- **Dominio + HTTPS**: cuando haya un dominio, agregar un reverse proxy (Caddy) delante de todo para HTTPS automático — hoy todo es HTTP plano por IP.
- **Backups**: los volúmenes de Postgres (`pg_data`, `evolution_pg_data`) no tienen backup automático todavía.
