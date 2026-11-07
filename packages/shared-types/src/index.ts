/** Enums y tipos compartidos entre frontend y backend (MVP). */

export const UserRoles = [
  'OWNER',
  'ADMIN',
  'MANAGER',
  'EMPLOYEE',
  'CUSTOMER',
] as const;
export type UserRole = (typeof UserRoles)[number];

export const BillingModes = [
  'CHARGE_ON_ALLOCATION',
  'CHARGE_ON_CONSUMPTION',
] as const;
export type BillingMode = (typeof BillingModes)[number];

export const ProductModalities = ['UNIT', 'CASE', 'BULK'] as const;
export type ProductModality = (typeof ProductModalities)[number];

export const CardStatuses = ['ACTIVE', 'REVOKED', 'LOST', 'EXPIRED'] as const;
export type CardStatus = (typeof CardStatuses)[number];

export const SaleTriggers = ['ALLOCATION', 'CONSUMPTION', 'MANUAL'] as const;
export type SaleTrigger = (typeof SaleTriggers)[number];

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  customerId?: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
