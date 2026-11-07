# LiquorControl

SaaS multiempresa para licorerías: inventario en unidad base decimal, clientes con tarjeta QR, asignaciones, consumo y cobro configurable (al asignar y / o al consumir).

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

# 4. Prisma + seed (tenant demo + admin + producto + tarjeta + proveedor)
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
| Producto | `JW-RED-750` @ $450 / unidad base |
| Proveedor | `DIST-01` Distribuidora Norte |

El seed imprime el **token de tarjeta** QR (solo al emitir/seed; no se persiste en claro).

## Happy path Fase 1: tarjeta → consumo

1. Login en http://localhost:5173 con `admin@demo.local` / `Admin123!`.
2. **Inventario** / seed: verifica saldo del producto.
3. **Clientes**: emite/copia el token QR del cliente `CLI-001`.
4. **Terminal POS**: Resolver → Asignar → Consumir.
5. **Historial**: consumos y movimientos inmutables.

## Happy path Fase 2: compra → venta/caja → devolución

1. **Compras**: crea/usa proveedor → OC con costo → Confirmar → **Recibir** (genera `PURCHASE_IN` inmutable).
2. **Caja/Ventas**: Abrir caja (fondo inicial) → venta de mostrador con pago efectivo/tarjeta/transferencia (o dejar CxC).
3. Abona cuentas por cobrar desde la misma pantalla; abre **comprobante HTML** imprimible.
4. **Devoluciones**: tipo asignación o venta → reintegra saldo/existencias con movimientos de reversión (no edita históricos) → comprobante.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"Admin123!"}' | jq -r .accessToken)

# Abrir caja
curl -s -X POST http://localhost:3000/api/v1/cash-sessions/open \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"warehouseId":"…","openingFloat":500}' | jq

# Venta + pago
curl -s -X POST http://localhost:3000/api/v1/sales \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"warehouseId":"…","lines":[{"productId":"…","quantityBase":1}],"paymentMethod":"CASH","paymentAmount":450}' | jq
```

## Módulos

### Fase 1 (MVP)
- Auth JWT + roles/tenant, catálogo, inventario, clientes/QR, asignaciones, consumos idempotentes

### Fase 2 (operación comercial)
- Proveedores + órdenes de compra / recepción
- Caja (apertura/cierre), ventas, pagos (efectivo/tarjeta/transferencia)
- Cuentas por cobrar (abonos, saldos `PENDING`/`PARTIAL`)
- Precios por producto + lista por cliente
- Devoluciones (asignación/venta) con reversiones inmutables
- Comprobantes HTML imprimibles (`/receipts/sales|payments|returns/:id`)
- UI: Compras, Caja/Ventas, Devoluciones

### Fase 3 (administración)
- Dashboard: existencias valorizadas, ventas del día, top productos, consumo, alertas de stock, movimientos
- Reportes: inventario valorizado, más vendidos, consumo por cliente, compras/proveedores, rentabilidad, diferencias de inventario, estado de cuenta
- Exportes Excel (ExcelJS) y PDF (PDFKit)
- Auditoría de mutaciones (quién/qué/cuándo/contexto) + UI
- Alertas `minStock` en producto + listado `/alerts/low-stock`
- Permisos detallados por rol/tenant + overrides de usuario; guards en API
- UI: Dashboard, Reportes, Auditoría, Usuarios/permisos

## Cómo verificar Fase 3

```bash
npm run db:setup
npm run dev:backend
npm run dev:frontend
```

1. Login `admin@demo.local` / `Admin123!`
2. **Dashboard**: existencias, ventas del día, alertas (seed pone `minStock=100` en JW-RED-750).
3. **Reportes**: revisa tablas y descarga Excel/PDF de inventario y más vendidos; consulta estado de cuenta.
4. **Auditoría**: tras crear una venta/compra, aparece el evento.
5. **Usuarios**: crea un EMPLOYEE y ajusta la matriz de permisos del rol MANAGER.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.local","password":"Admin123!"}' | jq -r .accessToken)

curl -s http://localhost:3000/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN" | jq
curl -s -OJ http://localhost:3000/api/v1/reports/export/inventory-valued.xlsx -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/v1/alerts/low-stock -H "Authorization: Bearer $TOKEN" | jq
curl -s http://localhost:3000/api/v1/audit-logs -H "Authorization: Bearer $TOKEN" | jq '.[0]'
```

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
