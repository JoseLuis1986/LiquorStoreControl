import { useEffect, useState } from 'react';
import { Alert, Paper, Stack, Typography } from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function AdminHome() {
  const { session, token } = useAuth();
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(
    null,
  );

  useEffect(() => {
    if (!token) return;
    api<{ name: string; slug: string }>('/tenants/me', { token })
      .then(setTenant)
      .catch(() => undefined);
  }, [token]);

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="h4">Panel administrativo</Typography>
        <Typography color="text.secondary">
          Bienvenido, {session?.user.fullName}. Gestiona productos, inventario,
          clientes/tarjetas QR, asignaciones y consumo desde el menú.
        </Typography>
        {tenant ? (
          <Alert severity="info">
            Tenant activo: <strong>{tenant.name}</strong> ({tenant.slug}) · rol{' '}
            {session?.user.role}
          </Alert>
        ) : null}
        <Alert severity="success">
          Flujo happy path: Inventario → Clientes (emitir QR) → Terminal POS
          (resolver → asignar → consumir) → Historial.
        </Alert>
      </Stack>
    </Paper>
  );
}
