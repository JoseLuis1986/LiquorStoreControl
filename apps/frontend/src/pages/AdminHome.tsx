import { Alert, Paper, Stack, Typography } from '@mui/material';

export function AdminHome() {
  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="h4">Panel administrativo</Typography>
        <Typography color="text.secondary">
          Scaffold del monorepo LiquorControl. Desde aquí se gestionarán
          productos, inventario, clientes, asignaciones y cobros configurables
          por cliente.
        </Typography>
        <Alert severity="info">
          Multi-tenant SaaS · inventario en unidad base decimal · QR sin PII ·
          web responsive (admin + POS).
        </Alert>
      </Stack>
    </Paper>
  );
}
