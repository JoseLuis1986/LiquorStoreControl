import { useEffect, useState } from 'react';
import {
  Alert,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useExchange } from '../context/ExchangeContext';

type Summary = {
  inventory: { skuCount: number; balanceLines: number; stockValue: string };
  salesToday: { count: number; totalAmount: string; amountPaid: string };
  topProducts: { sku: string; name: string; qty: number; amount: number }[];
  customerConsumptionToday: {
    customer: string;
    lines: { sku: string; qty: string }[];
    at: string;
  }[];
  lowStockAlerts: {
    sku: string;
    name: string;
    warehouse: string;
    quantityBase: string;
    minStock: string;
  }[];
  recentMovements: {
    type: string;
    sku: string;
    warehouse: string;
    quantityBase: string;
    createdAt: string;
  }[];
};

export function DashboardPage() {
  const { token } = useAuth();
  const { money } = useExchange();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Summary>('/dashboard/summary', { token })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>Cargando dashboard…</Typography>;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Dashboard</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Inventario valorizado
          </Typography>
          <Typography variant="h4">{money(data.inventory.stockValue)}</Typography>
          <Typography variant="body2">
            {data.inventory.skuCount} SKUs · {data.inventory.balanceLines} saldos
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Ventas del día
          </Typography>
          <Typography variant="h4">{money(data.salesToday.totalAmount)}</Typography>
          <Typography variant="body2">
            {data.salesToday.count} ventas · cobrado {money(data.salesToday.amountPaid)}
          </Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Alertas stock bajo
          </Typography>
          <Typography variant="h4">{data.lowStockAlerts.length}</Typography>
          <Typography variant="body2">Productos ≤ mínimo</Typography>
        </Paper>
      </Stack>

      {data.lowStockAlerts.length ? (
        <Alert severity="warning">
          Stock bajo:{' '}
          {data.lowStockAlerts
            .map((a) => `${a.sku} (${a.quantityBase}/${a.minStock} @${a.warehouse})`)
            .join(' · ')}
        </Alert>
      ) : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Top productos (30 días)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Monto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.topProducts.map((p) => (
              <TableRow key={p.sku}>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell align="right">{p.qty}</TableCell>
                <TableCell align="right">{money(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Consumo clientes (hoy)
        </Typography>
        {data.customerConsumptionToday.length === 0 ? (
          <Typography color="text.secondary">Sin consumos hoy</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Detalle</TableCell>
                <TableCell>Hora</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.customerConsumptionToday.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.customer}</TableCell>
                  <TableCell>
                    {c.lines.map((l) => `${l.sku}×${l.qty}`).join(', ')}
                  </TableCell>
                  <TableCell>{new Date(c.at).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Movimientos recientes
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Almacén</TableCell>
              <TableCell align="right">Δ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.recentMovements.map((m, i) => (
              <TableRow key={i}>
                <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                <TableCell>{m.type}</TableCell>
                <TableCell>{m.sku}</TableCell>
                <TableCell>{m.warehouse}</TableCell>
                <TableCell align="right">{m.quantityBase}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
