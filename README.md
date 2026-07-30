# Hielo Guala

App para gestionar pedidos de hielo que llegan por WhatsApp: los pedidos se capturan automáticamente (n8n + WhatsApp Cloud API), quedan guardados con su horario de llegada, se muestran en un tablero ordenado por orden de llegada (FIFO), y al marcarlos "Entregado" se registran automáticamente como venta para métricas futuras.

## Estado del proyecto

MVP completo (`v0.1.0-mvp`) y desplegado para prueba con cliente. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el diseño completo.

## En producción

App corriendo en un VPS de prueba: **http://65.21.250.228/**. Ver [docs/DEPLOY.md](docs/DEPLOY.md) para acceso al servidor y cómo redesplegar.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma (PostgreSQL)
- **Frontend**: React + Vite
- **Automatización**: n8n (self-hosted) + WhatsApp — dos opciones, ver [n8n/README.md](n8n/README.md): Cloud API oficial (Meta) o Evolution API (no oficial, por QR)
- **Infra**: Docker Compose (Postgres, backend, frontend, n8n)

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con backend WSL2 en Windows)
- Node.js 20+ (solo si querés correr algo fuera de Docker)

## Puesta en marcha (desarrollo local)

```bash
cp .env.example .env
# completar valores en .env (credenciales, tokens de WhatsApp cuando corresponda)

docker compose up --build
```

Servicios expuestos:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- n8n: http://localhost:5678
- Postgres: localhost:5432

## Estructura del repo

```
backend/    API REST (Express + Prisma) y parser de pedidos
frontend/   Tablero de pedidos, administración de productos y métricas (React)
n8n/        Workflow exportado de n8n para la integración con WhatsApp
docs/       Documentación de arquitectura y reglas del parser
```

## Roadmap (milestones)

- [x] M1 — Scaffold del repo + docker-compose
- [x] M2 — Modelo de datos (Prisma) + seed de productos
- [x] M3 — API backend + parser de pedidos
- [x] M4 — Tablero de pedidos (FIFO + Entregado)
- [x] M5 — Administración de productos/precios + métricas de ventas
- [x] M6 — Workflow de n8n + WhatsApp Cloud API
- [x] M7 — Validación end-to-end (`v0.1.0-mvp`)
