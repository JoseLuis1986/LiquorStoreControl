import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
  customerId?: string | null;
  typ: 'access' | 'refresh';
}

export interface AuthUserContext {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  customerId?: string | null;
}
