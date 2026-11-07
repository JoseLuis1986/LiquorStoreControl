import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { CardsModule } from './cards/cards.module';
import { CatalogModule } from './catalog/catalog.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { AllocationsModule } from './allocations/allocations.module';
import { ConsumptionsModule } from './consumptions/consumptions.module';
import { SalesModule } from './sales/sales.module';
import { MeModule } from './me/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    CustomersModule,
    CardsModule,
    CatalogModule,
    WarehousesModule,
    InventoryModule,
    OrdersModule,
    AllocationsModule,
    ConsumptionsModule,
    SalesModule,
    MeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
