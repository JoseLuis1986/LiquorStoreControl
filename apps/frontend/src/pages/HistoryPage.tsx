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

type Consumption = {
  id: string;
  createdAt: string;
  idempotencyKey: string;
  customer: { code: string; name: string };
  lines: { quantityBase: string; product: { sku: string; name: string } }[];
};

type Movement = {
  id: string;
  type: string;
  quantityBase: string;
  createdAt: string;
  product: { sku: string };
};

export function HistoryPage() {
  const { token } = useAuth();
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<Consumption[]>('/consumptions', { token }),
      api<Movement[]>('/inventory/movements', { token }),
    ])
      .then(([c, m]) => {
        setConsumptions(c);
        setMovements(m);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Historial de consumos
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Líneas</TableCell>
              <TableCell>Idempotency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {consumptions.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  {c.customer.code} — {c.customer.name}
                </TableCell>
                <TableCell>
                  {c.lines
                    .map((l) => `${l.product.sku} × ${l.quantityBase}`)
                    .join(', ')}
                </TableCell>
                <TableCell>
                  <code style={{ fontSize: 12 }}>{c.idempotencyKey.slice(0, 12)}…</code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Movimientos de inventario
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Δ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.slice(0, 30).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                <TableCell>{m.type}</TableCell>
                <TableCell>{m.product.sku}</TableCell>
                <TableCell align="right">{m.quantityBase}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
