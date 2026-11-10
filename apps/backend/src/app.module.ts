import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { SuppliersModule } from './suppliers/suppliers.module';
import { CashModule } from './cash/cash.module';
import { ReturnsModule } from './returns/returns.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { BranchesModule } from './branches/branches.module';
import { TransfersModule } from './transfers/transfers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ExchangeModule } from './exchange/exchange.module';
import { ServiceDeskModule } from './service-desk/service-desk.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { EmployeeScopeInterceptor } from './common/interceptors/employee-scope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    PermissionsModule,
    AuditModule,
    AuthModule,
    RealtimeModule,
    TenantsModule,
    UsersModule,
    CustomersModule,
    CardsModule,
    CatalogModule,
    WarehousesModule,
    BranchesModule,
    InventoryModule,
    TransfersModule,
    OrdersModule,
    AllocationsModule,
    ConsumptionsModule,
    SalesModule,
    MeModule,
    SuppliersModule,
    CashModule,
    ReturnsModule,
    ReceiptsModule,
    DashboardModule,
    ReportsModule,
    AlertsModule,
    AnalyticsModule,
    ExchangeModule,
    ServiceDeskModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: EmployeeScopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
