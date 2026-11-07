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
- Docker (PostgreSQL 16) **o** PostgreSQL 16 local

## Arranque local

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Base de datos
npm run db:up          # Docker Compose
# (alternativa sin Docker: crea DB liquor_control y usuario liquor/liquor)

# 3. Dependencias
npm install

# 4. Prisma + seed (tenant demo + admin + producto + tarjeta)
npm run db:setup

# 5. Apps (dos terminales)
npm run dev:backend    # http://localhost:3000/api/v1/health
npm run dev:frontend   # http://localhost:5173
```

### Credenciales seed

| Campo | Valor |
|-------|--------|
| Email | `admin@demo.local` |
| Password | `Admin123!` |
| Tenant | `demo-licoreria` |

El seed imprime el **token de tarjeta** QR (solo al emitir/seed; no se persiste en claro).

## Happy path: tarjeta → consumo

1. Login en http://localhost:5173 con `admin@demo.local` / `Admin123!`.
2. **Inventario**: verifica saldo del producto seed (o registra una entrada).
3. **Clientes**: emite/copia el token QR del cliente `CLI-001` (o usa el token del seed).
4. **Terminal POS**:
   - Pega el token → **Resolver** (rechaza tarjeta bloqueada).
   - **Asignar** cajas/unidades → descuenta inventario general y sube saldo asignado.
   - **Consumir** con cantidad ≤ restante → descuenta solo el saldo asignado (idempotency-key automática).
5. **Historial**: revisa consumos y movimientos inmutables.

### API equivalente (curl)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"Admin123!"}' | jq -r .accessToken)

# Resolver tarjeta
curl -s -X POST http://localhost:3000/api/v1/cards/resolve \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"token\":\"$CARD_TOKEN\"}" | jq

# Consumo (Idempotency-Key obligatorio)
curl -s -X POST http://localhost:3000/api/v1/consumptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"...","warehouseId":"...","lines":[{"productId":"...","quantityBase":1}]}' | jq
```

## Módulos MVP

- Auth JWT (access + refresh) + roles por tenant
- Productos, categorías, unidades, presentaciones/conversiones
- Inventario: balances, entradas, movimientos append-only + reversiones
- Clientes + tarjetas QR (emitir / bloquear / reponer; token hasheado sin PII)
- Asignaciones: `assigned − consumed − returned`; stock baja al asignar
- Consumos transaccionales con `Idempotency-Key`
- Sales stubs según `billingModes` del cliente
- UI: login, productos, clientes/tarjetas, inventario, POS, historial

## Decisiones de alcance (confirmadas)

1. Multi-tenant desde el modelo de datos.
2. Cobro configurable por cliente: al asignar y/o al consumir.
3. Empleados operan el escaneo; clientes consultan su consumo (`/me/*`).
4. Web responsive primero (sin app móvil ni escritorio en v1).

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run db:up` | Levanta PostgreSQL (Docker) |
| `npm run db:setup` | generate + migrate deploy + seed |
| `npm run prisma:seed` | Solo seed |
| `npm run build` | Build shared-types + backend + frontend |

## Notas

- No commitear `.env` ni secretos reales.
- Los tokens de tarjeta se almacenan solo como hash SHA-256; el QR no lleva PII.
- Reversiones = nuevos movimientos; nunca se editan cantidades históricas.
