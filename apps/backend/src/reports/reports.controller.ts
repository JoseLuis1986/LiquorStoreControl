import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUserContext } from '../common/types/auth-user';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private range(from?: string, to?: string) {
    return {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
  }

  @Get('inventory-valued')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @RequirePermissions('reports:read')
  inventory(@CurrentUser() user: AuthUserContext) {
    return this.reports.inventoryValued(user.tenantId);
  }

  @Get('top-sellers')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @RequirePermissions('reports:read')
  top(
    @CurrentUser() user: AuthUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const r = this.range(from, to);
    return this.reports.topSellers(user.tenantId, r.from, r.to);
  }

  @Get('consumption-by-customer')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:read')
  consumption(
    @CurrentUser() user: AuthUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('customerId') customerId?: string,
  ) {
    const r = this.range(from, to);
    return this.reports.consumptionByCustomer(
      user.tenantId,
      r.from,
      r.to,
      customerId,
    );
  }

  @Get('purchases-by-supplier')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:read')
  purchases(
    @CurrentUser() user: AuthUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const r = this.range(from, to);
    return this.reports.purchasesBySupplier(user.tenantId, r.from, r.to);
  }

  @Get('profitability')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:read')
  profit(
    @CurrentUser() user: AuthUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const r = this.range(from, to);
    return this.reports.profitability(user.tenantId, r.from, r.to);
  }

  @Get('inventory-differences')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:read')
  diffs(@CurrentUser() user: AuthUserContext) {
    return this.reports.inventoryDifferences(user.tenantId);
  }

  @Get('customer-statement/:customerId')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @RequirePermissions('reports:read')
  statement(
    @CurrentUser() user: AuthUserContext,
    @Param('customerId') customerId: string,
  ) {
    return this.reports.customerStatement(user.tenantId, customerId);
  }

  @Get('export/inventory-valued.xlsx')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:export')
  async exportInvXlsx(
    @CurrentUser() user: AuthUserContext,
    @Res() res: Response,
  ) {
    const data = await this.reports.inventoryValued(user.tenantId);
    const buf = await this.reports.toExcel(
      'Inventario',
      [
        { header: 'Almacén', key: 'warehouse', width: 12 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Producto', key: 'name', width: 32 },
        { header: 'Cantidad', key: 'quantityBase', width: 12 },
        { header: 'P.U.', key: 'unitPrice', width: 12 },
        { header: 'Valor', key: 'value', width: 14 },
        { header: 'Mínimo', key: 'minStock', width: 10 },
      ],
      data.rows,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventario-valorizado.xlsx"',
    );
    res.send(buf);
  }

  @Get('export/inventory-valued.pdf')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:export')
  async exportInvPdf(
    @CurrentUser() user: AuthUserContext,
    @Res() res: Response,
  ) {
    const data = await this.reports.inventoryValued(user.tenantId);
    const lines = [
      `Total valorizado: ${data.totalValue.toFixed(2)}`,
      '',
      ...data.rows.map(
        (r) =>
          `${r.warehouse} | ${r.sku} | ${r.quantityBase} × ${r.unitPrice} = ${r.value.toFixed(2)}`,
      ),
    ];
    const buf = await this.reports.toPdf('Inventario valorizado', lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventario-valorizado.pdf"',
    );
    res.send(buf);
  }

  @Get('export/top-sellers.xlsx')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:export')
  async exportTopXlsx(
    @CurrentUser() user: AuthUserContext,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const r = this.range(from, to);
    const rows = await this.reports.topSellers(user.tenantId, r.from, r.to);
    const buf = await this.reports.toExcel(
      'Top',
      [
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Producto', key: 'name', width: 32 },
        { header: 'Cantidad', key: 'qty', width: 12 },
        { header: 'Ingresos', key: 'revenue', width: 14 },
      ],
      rows,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mas-vendidos.xlsx"',
    );
    res.send(buf);
  }

  @Get('export/customer-statement/:customerId.pdf')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePermissions('reports:export')
  async exportStatementPdf(
    @CurrentUser() user: AuthUserContext,
    @Param('customerId') customerId: string,
    @Res() res: Response,
  ) {
    const st = await this.reports.customerStatement(user.tenantId, customerId);
    const lines = [
      `Cliente: ${st.customer.code} — ${st.customer.name}`,
      `Saldo por cobrar: ${st.openReceivable}`,
      '',
      'Ventas:',
      ...st.sales.map(
        (s) =>
          `${s.date.toISOString().slice(0, 10)} ${s.number} ${s.status} total=${s.totalAmount} pagado=${s.amountPaid} saldo=${s.due}`,
      ),
      '',
      'Saldos asignados:',
      ...st.allocationBalances.map(
        (a) =>
          `${a.sku} @${a.warehouse}: restante ${a.remaining} (asig ${a.assigned} / cons ${a.consumed} / dev ${a.returned})`,
      ),
    ];
    const buf = await this.reports.toPdf('Estado de cuenta', lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="estado-cuenta-${st.customer.code}.pdf"`,
    );
    res.send(buf);
  }
}
