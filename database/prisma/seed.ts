import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hashCardToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
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
  }

  const warehouse =
    (await prisma.warehouse.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: 'MAIN' } },
    })) ??
    (await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        code: 'MAIN',
        name: 'Almacén principal',
      },
    }));

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

  // eslint-disable-next-line no-console
  console.log(`
Seed OK
---------
Tenant:   ${tenant.name} (${tenant.slug})
Admin:    ${email} / ${password}
Warehouse:${warehouse.code}
Product:  ${product.sku}
Customer: ${customer.code} — ${customer.name}
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
