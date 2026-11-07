# LiquorControl

SaaS multiempresa para licorerías: inventario en unidad base decimal, clientes con tarjeta QR, asignaciones, consumo y cobro configurable (al asignar y/ o al consumir).

Plataforma v1: **web responsive** (admin + terminal POS/escaneo).

## Monorepo

```
apps/frontend     React + TypeScript + Vite + MUI
apps/backend      NestJS + TypeScript + Prisma Client
packages/shared-types
database/prisma   schema + migraciones PostgreSQL
docker-compose.yml
```

## Requisitos

- Node.js ≥ 20
- Docker (PostgreSQL 16)

## Arranque local

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Base de datos
npm run db:up

# 3. Dependencias
npm install

# 4. Cliente Prisma + migraciones
npm run prisma:generate
npm run prisma:deploy

# 5. Apps
npm run dev:backend    # http://localhost:3000/api/v1/health
npm run dev:frontend   # http://localhost:5173
```

## Decisiones de alcance (confirmadas)

1. Multi-tenant desde el modelo de datos.
2. Cobro configurable por cliente: al asignar y/o al consumir.
3. Empleados operan el escaneo; clientes consultan su consumo.
4. Web responsive primero (sin app móvil ni escritorio en v1).

Documentación de arquitectura: Project store → `docs/technical-architecture.md`.

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run db:up` | Levanta PostgreSQL |
| `npm run prisma:migrate` | Migración interactiva (dev) |
| `npm run prisma:deploy` | Aplica migraciones existentes |
| `npm run build` | Build de shared-types + backend + frontend |

## Notas

- No commitear `.env` ni secretos reales.
- Los tokens de tarjeta se almacenan solo como hash; el QR no lleva PII.
