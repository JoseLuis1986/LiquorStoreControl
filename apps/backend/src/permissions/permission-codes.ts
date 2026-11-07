/** Códigos de permiso estables usados por guards y seed. */
export const PERMISSIONS = [
  { code: 'dashboard:read', name: 'Ver dashboard', module: 'dashboard' },
  { code: 'reports:read', name: 'Ver reportes', module: 'reports' },
  { code: 'reports:export', name: 'Exportar reportes', module: 'reports' },
  { code: 'audit:read', name: 'Ver auditoría', module: 'audit' },
  { code: 'users:manage', name: 'Gestionar usuarios', module: 'users' },
  { code: 'permissions:manage', name: 'Gestionar permisos', module: 'users' },
  { code: 'inventory:read', name: 'Ver inventario', module: 'inventory' },
  { code: 'inventory:write', name: 'Ajustar inventario', module: 'inventory' },
  { code: 'sales:read', name: 'Ver ventas', module: 'sales' },
  { code: 'sales:write', name: 'Registrar ventas/pagos', module: 'sales' },
  { code: 'purchases:write', name: 'Compras y recepción', module: 'purchases' },
  { code: 'pos:operate', name: 'Operar POS', module: 'pos' },
  { code: 'customers:write', name: 'Gestionar clientes', module: 'customers' },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

/** Matriz por defecto rol → permisos. OWNER tiene todos. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  OWNER: PERMISSIONS.map((p) => p.code),
  ADMIN: PERMISSIONS.map((p) => p.code),
  MANAGER: [
    'dashboard:read',
    'reports:read',
    'reports:export',
    'audit:read',
    'inventory:read',
    'inventory:write',
    'sales:read',
    'sales:write',
    'purchases:write',
    'pos:operate',
    'customers:write',
  ],
  EMPLOYEE: [
    'dashboard:read',
    'inventory:read',
    'sales:read',
    'sales:write',
    'pos:operate',
  ],
  CUSTOMER: [],
};
