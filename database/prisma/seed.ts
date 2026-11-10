import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
} from '../../apps/backend/src/permissions/permission-codes';

const prisma = new PrismaClient();

function hashCardToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

type CatalogPresentation = {
  name: string;
  unit: string;
  factor: number;
  isDefault?: boolean;
};

type CatalogItem = {
  sku: string;
  name: string;
  category: string;
  baseUnit: string;
  modality: 'UNIT' | 'CASE';
  price: number;
  minStock: number;
  stock: number;
  presentations: CatalogPresentation[];
};

function beer222(sku: string, name: string, price: number): CatalogItem {
  return {
    sku,
    name,
    category: 'Cerveza',
    baseUnit: 'BOT',
    modality: 'CASE',
    price,
    minStock: 36,
    stock: 72,
    presentations: [
      { name: 'Botella', unit: 'BOT', factor: 1, isDefault: true },
      { name: 'Caja x36', unit: 'CAJA', factor: 36 },
    ],
  };
}

function beer355(sku: string, name: string, price: number): CatalogItem {
  return {
    sku,
    name,
    category: 'Cerveza',
    baseUnit: 'BOT',
    modality: 'CASE',
    price,
    minStock: 24,
    stock: 72,
    presentations: [
      { name: 'Botella', unit: 'BOT', factor: 1, isDefault: true },
      { name: 'Caja x24', unit: 'CAJA', factor: 24 },
    ],
  };
}

function beerCan(sku: string, name: string, price: number): CatalogItem {
  return {
    sku,
    name,
    category: 'Cerveza',
    baseUnit: 'LATA',
    modality: 'CASE',
    price,
    minStock: 24,
    stock: 72,
    presentations: [
      { name: 'Lata', unit: 'LATA', factor: 1, isDefault: true },
      { name: 'Six pack', unit: 'PAQ', factor: 6 },
      { name: 'Caja x24', unit: 'CAJA', factor: 24 },
    ],
  };
}

function snack(sku: string, name: string, price: number): CatalogItem {
  return {
    sku,
    name,
    category: 'Snacks',
    baseUnit: 'UNI',
    modality: 'UNIT',
    price,
    minStock: 12,
    stock: 60,
    presentations: [
      { name: 'Unidad', unit: 'UNI', factor: 1, isDefault: true },
      { name: 'Caja x12', unit: 'CAJA', factor: 12 },
    ],
  };
}

/** Catálogo de licorería venezolana. El saldo es en unidad base (botella, lata o unidad). */
const VENEZUELAN_CATALOG: CatalogItem[] = [
  beer222('POL-PIL-222', 'Polar Pilsen 222 ml', 1),
  beer355('POL-PIL-355', 'Polar Pilsen 355 ml', 1.5),
  beerCan('POL-PIL-L355', 'Polar Pilsen lata 355 ml', 1.6),
  beer222('POL-LIG-222', 'Polar Light 222 ml', 1.1),
  beer355('POL-LIG-355', 'Polar Light 355 ml', 1.6),
  beerCan('POL-LIG-L355', 'Polar Light lata 355 ml', 1.7),
  beer355('POL-ICE-355', 'Polar Ice 355 ml', 1.7),
  beerCan('POL-ICE-L355', 'Polar Ice lata 355 ml', 1.8),
  beer355('SOL-VER-355', 'Solera Verde 355 ml', 1.8),
  beerCan('SOL-VER-L355', 'Solera Verde lata 355 ml', 1.9),
  beer355('SOL-AZU-355', 'Solera Azul 355 ml', 1.8),
  beerCan('SOL-AZU-L355', 'Solera Azul lata 355 ml', 1.9),
  beer222('ZUL-222', 'Cerveza Zulia 222 ml', 1),
  beer355('ZUL-355', 'Cerveza Zulia 355 ml', 1.5),
  beerCan('ZUL-L355', 'Cerveza Zulia lata 355 ml', 1.6),
  beer222('ZUL-LIG-222', 'Zulia Light 222 ml', 1.1),
  beer355('ZUL-LIG-355', 'Zulia Light 355 ml', 1.6),
  beer222('REG-222', 'Cerveza Regional 222 ml', 1),
  beer355('REG-355', 'Cerveza Regional 355 ml', 1.5),
  beerCan('REG-L355', 'Cerveza Regional lata 355 ml', 1.6),
  beer222('REG-LIG-222', 'Regional Light 222 ml', 1.1),
  beer355('REG-LIG-355', 'Regional Light 355 ml', 1.6),
  snack('SNK-PLAT-SAL', 'Platanitos salados 45 g', 1.2),
  snack('SNK-PLAT-PIC', 'Platanitos picantes 45 g', 1.2),
  snack('SNK-YUCA', 'Yuca frita salada 40 g', 1.2),
  snack('SNK-CHEESE', 'Cheese Tris 45 g', 1.3),
  snack('SNK-RUFF', 'Ruffles original 45 g', 1.5),
  snack('SNK-DORI', 'Doritos queso 45 g', 1.5),
  snack('SNK-MANI', 'Maní salado 80 g', 1),
  snack('SNK-MANI-JAP', 'Maní japonés 80 g', 1.3),
  snack('SNK-CHICH', 'Chicharrón 30 g', 1.4),
  snack('SNK-TOST', 'Tostones de plátano 40 g', 1.3),
  snack('SNK-PEPITO', 'Galleta Pepito 24 g', 0.8),
  snack('SNK-SUSY', 'Susy 50 g', 1),
  snack('SNK-TORONTO', 'Toronto 36 g', 1),
  snack('SNK-SAMBA', 'Samba 32 g', 0.9),
  snack('SNK-COCO', 'Cocosette 50 g', 1.1),
  snack('SNK-SAVOY', 'Savoy de leche 30 g', 0.9),
  snack('SNK-PIRULIN', 'Pirulín 30 g', 0.8),
  snack('SNK-ACEIT', 'Aceitunas rellenas 90 g', 2),
  snack('SNK-CLUB', 'Club Social 26 g', 0.9),
  snack('SNK-MEREY', 'Merey salado 40 g', 1.6),
  snack('SNK-TEQ', 'Tequeños de queso 10 und', 3.5),
];

async function seedVenezuelanCatalog(input: {
  tenantId: string;
  warehouseId: string;
  userId: string;
}) {
  const { tenantId, warehouseId, userId } = input;
  const unitDefs = [
    { code: 'BOT', name: 'Botella' },
    { code: 'CAJA', name: 'Caja' },
    { code: 'LATA', name: 'Lata' },
    { code: 'PAQ', name: 'Paquete' },
    { code: 'UNI', name: 'Unidad' },
  ];
  const units = new Map<string, string>();
  for (const unit of unitDefs) {
    const row = await prisma.unitOfMeasure.upsert({
      where: { tenantId_code: { tenantId, code: unit.code } },
      create: { tenantId, code: unit.code, name: unit.name, kind: 'COUNT' },
      update: {},
    });
    units.set(unit.code, row.id);
  }

  const categories = new Map<string, string>();
  for (const name of ['Cerveza', 'Snacks']) {
    const code = name === 'Cerveza' ? 'CER' : 'SNK';
    const row = await prisma.category.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: { tenantId, name, code },
      update: {},
    });
    categories.set(name, row.id);
  }

  for (const item of VENEZUELAN_CATALOG) {
    const baseUnitId = units.get(item.baseUnit);
    const categoryId = categories.get(item.category);
    if (!baseUnitId || !categoryId) {
      throw new Error(`Catálogo incompleto para ${item.sku}`);
    }

    let product = await prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: item.sku } },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId,
          sku: item.sku,
          name: item.name,
          baseUnitId,
          categoryId,
          modality: item.modality,
          defaultUnitPrice: item.price,
          minStock: item.minStock,
        },
      });
    }

    for (const presentation of item.presentations) {
      const unitId = units.get(presentation.unit);
      if (!unitId) throw new Error(`Unidad ${presentation.unit} no existe`);
      const existing = await prisma.productPresentation.findFirst({
        where: { tenantId, productId: product.id, name: presentation.name },
      });
      if (!existing) {
        await prisma.productPresentation.create({
          data: {
            tenantId,
            productId: product.id,
            unitId,
            name: presentation.name,
            factorToBase: presentation.factor,
            isDefault: presentation.isDefault ?? false,
          },
        });
      }
    }

    const balance = await prisma.inventoryBalance.findUnique({
      where: {
        tenantId_warehouseId_productId: {
          tenantId,
          warehouseId,
          productId: product.id,
        },
      },
    });
    const current = balance ? Number(balance.quantityBase) : 0;
    if (current >= item.stock) continue;
    const delta = item.stock - current;
    if (!balance) {
      await prisma.inventoryBalance.create({
        data: {
          tenantId,
          warehouseId,
          productId: product.id,
          quantityBase: item.stock,
        },
      });
    } else {
      await prisma.inventoryBalance.update({
        where: { id: balance.id },
        data: { quantityBase: item.stock },
      });
    }
    await prisma.inventoryMovement.create({
      data: {
        tenantId,
        warehouseId,
        productId: product.id,
        type: 'PURCHASE_IN',
        quantityBase: delta,
        referenceType: 'SEED_CATALOG',
        notes: 'Stock inicial catálogo licorería',
        createdByUserId: userId,
      },
    });
  }

  return VENEZUELAN_CATALOG.length;
}

async function main() {
  const slug = 'demo-licoreria';
  let tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Demo Licorería', slug, status: 'ACTIVE' },
    });
  }

  const email = 'admin@demo.local';
  const password = 'Admin123!';
  const passwordHash = await bcrypt.hash(password, 10);

  let admin = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        fullName: 'Admin Demo',
        role: UserRole.OWNER,
        status: 'ACTIVE',
      },
    });
  }

  const waiterEmail = 'camarero@demo.local';
  const waiterPasswordHash = await bcrypt.hash('Camarero123!', 10);
  const existingWaiter = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: waiterEmail } },
  });
  if (!existingWaiter) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: waiterEmail,
        passwordHash: waiterPasswordHash,
        fullName: 'Camarero',
        role: UserRole.EMPLOYEE,
        status: 'ACTIVE',
      },
    });
  }

  const bottle =
    (await prisma.unitOfMeasure.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'BOT' } },
    })) ??
    (await prisma.unitOfMeasure.create({
      data: {
        tenantId: tenant.id,
        code: 'BOT',
        name: 'Botella',
        kind: 'COUNT',
      },
    }));

  const caseUnit =
    (await prisma.unitOfMeasure.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'CAJA' } },
    })) ??
    (await prisma.unitOfMeasure.create({
      data: {
        tenantId: tenant.id,
        code: 'CAJA',
        name: 'Caja',
        kind: 'COUNT',
      },
    }));

  const category =
    (await prisma.category.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Whisky' } },
    })) ??
    (await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Whisky', code: 'WHI' },
    }));

  let product = await prisma.product.findUnique({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'JW-RED-750' } },
  });
  if (!product) {
    product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'JW-RED-750',
        name: 'Johnnie Walker Red Label 750ml',
        baseUnitId: bottle.id,
        categoryId: category.id,
        modality: 'CASE',
        defaultUnitPrice: 450,
        presentations: {
          create: [
            {
              tenantId: tenant.id,
              unitId: bottle.id,
              name: 'Botella',
              factorToBase: 1,
              isDefault: true,
            },
            {
              tenantId: tenant.id,
              unitId: caseUnit.id,
              name: 'Caja x12',
              factorToBase: 12,
              isDefault: false,
            },
          ],
        },
      },
    });
  } else {
    await prisma.product.update({
      where: { id: product.id },
      data: { defaultUnitPrice: 450, minStock: 100 },
    });
  }
  await prisma.product.update({
    where: { id: product.id },
    data: { minStock: 100 },
  });

  const supplier =
    (await prisma.supplier.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'DIST-01' } },
    })) ??
    (await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: 'DIST-01',
        name: 'Distribuidora Norte',
        phone: '555-0100',
      },
    }));

  const branchCentro =
    (await prisma.branch.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'CENTRO' } },
    })) ??
    (await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'CENTRO',
        name: 'Sucursal Centro',
        address: 'Av. Principal 100',
      },
    }));

  const branchNorte =
    (await prisma.branch.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'NORTE' } },
    })) ??
    (await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        code: 'NORTE',
        name: 'Sucursal Norte',
        address: 'Blvd. Norte 50',
      },
    }));

  const warehouse =
    (await prisma.warehouse.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    })) ??
    (await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branchCentro.id,
        code: 'MAIN',
        name: 'Almacén principal',
      },
    }));
  if (!warehouse.branchId) {
    await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { branchId: branchCentro.id },
    });
  }

  const warehouseNorte =
    (await prisma.warehouse.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'NORTE' } },
    })) ??
    (await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        branchId: branchNorte.id,
        code: 'NORTE',
        name: 'Almacén Norte',
      },
    }));

  await prisma.user.update({
    where: { id: admin.id },
    data: { defaultBranchId: branchCentro.id },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_warehouseId_productId: {
        tenantId: tenant.id,
        warehouseId: warehouseNorte.id,
        productId: product.id,
      },
    },
    create: {
      tenantId: tenant.id,
      warehouseId: warehouseNorte.id,
      productId: product.id,
      quantityBase: 40,
    },
    update: {},
  });

  await prisma.inventoryBalance.upsert({
    where: {
      tenantId_warehouseId_productId: {
        tenantId: tenant.id,
        warehouseId: warehouse.id,
        productId: product.id,
      },
    },
    create: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      productId: product.id,
      quantityBase: 120,
    },
    update: {},
  });

  const existingMove = await prisma.inventoryMovement.findFirst({
    where: {
      tenantId: tenant.id,
      productId: product.id,
      referenceType: 'SEED',
    },
  });
  if (!existingMove) {
    await prisma.inventoryMovement.create({
      data: {
        tenantId: tenant.id,
        warehouseId: warehouse.id,
        productId: product.id,
        type: 'PURCHASE_IN',
        quantityBase: 120,
        referenceType: 'SEED',
        notes: 'Stock inicial seed',
        createdByUserId: admin.id,
      },
    });
  }

  const catalogCount = await seedVenezuelanCatalog({
    tenantId: tenant.id,
    warehouseId: warehouse.id,
    userId: admin.id,
  });

  let customer = await prisma.customer.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CLI-001' } },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        code: 'CLI-001',
        name: 'Hotel Centro',
        billingModes: ['CHARGE_ON_ALLOCATION', 'CHARGE_ON_CONSUMPTION'],
        email: 'hotel@demo.local',
        status: 'ACTIVE',
      },
    });
  }

  let cardToken = process.env.SEED_CARD_TOKEN;
  const existingCard = await prisma.card.findFirst({
    where: { tenantId: tenant.id, customerId: customer.id, status: 'ACTIVE' },
  });
  if (!existingCard) {
    cardToken = cardToken ?? randomBytes(32).toString('base64url');
    await prisma.card.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        tokenHash: hashCardToken(cardToken),
        label: 'Tarjeta principal',
        status: 'ACTIVE',
      },
    });
  }

  const serviceCards: { code: string; name: string }[] = [
    { code: 'MESA-01', name: 'Mesa 01' },
  ];
  for (let n = 1; n <= 50; n++) {
    const num = String(n).padStart(2, '0');
    serviceCards.push({ code: `CLI-${num}`, name: `Cliente ${num}` });
  }
  for (const service of serviceCards) {
    let serviceCustomer = await prisma.customer.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: service.code } },
    });
    if (!serviceCustomer) {
      serviceCustomer = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          code: service.code,
          name: service.name,
          billingModes: [],
          status: 'ACTIVE',
        },
      });
    }
    const serviceCard = await prisma.card.findFirst({
      where: {
        tenantId: tenant.id,
        customerId: serviceCustomer.id,
        status: 'ACTIVE',
      },
    });
    if (!serviceCard) {
      await prisma.card.create({
        data: {
          tenantId: tenant.id,
          customerId: serviceCustomer.id,
          tokenHash: hashCardToken(randomBytes(32).toString('base64url')),
          label: service.name,
          status: 'ACTIVE',
        },
      });
    }
  }

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name, module: p.module },
      update: { name: p.name, module: p.module },
    });
  }
  const allPerms = await prisma.permission.findMany();
  const byCode = new Map(allPerms.map((p) => [p.code, p.id]));
  for (const [role, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    for (const code of codes) {
      const permissionId = byCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          tenantId_role_permissionId: {
            tenantId: tenant.id,
            role: role as UserRole,
            permissionId,
          },
        },
        create: {
          tenantId: tenant.id,
          role: role as UserRole,
          permissionId,
        },
        update: {},
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`
Seed OK
---------
Tenant:   ${tenant.name} (${tenant.slug})
Admin:    ${email} / ${password}
Camarero: camarero@demo.local / Camarero123! (solo servicio en mesa)
Branches: ${branchCentro.code}, ${branchNorte.code}
Warehouses:${warehouse.code} (CENTRO), ${warehouseNorte.code} (NORTE)
Product:  ${product.sku} (minStock=100, price=450)
Catálogo: ${catalogCount} productos de licorería en ${warehouse.code} (saldo ≥ 50 u. base)
Customer: ${customer.code} — ${customer.name}
Servicio: MESA-01 · CLI-01 … CLI-50 (tarjetas para imprimir; el código no cambia si editas el nombre)
Supplier: ${supplier.code} — ${supplier.name}
Permisos: ${PERMISSIONS.length} códigos · roles seeded
${cardToken ? `Card token (guardar, solo se muestra al emitir/seed): ${cardToken}` : 'Card token: (ya existía; re-emite desde UI si lo necesitas)'}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
