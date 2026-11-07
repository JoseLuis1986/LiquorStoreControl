import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type InvReport = {
  rows: {
    warehouse: string;
    sku: string;
    name: string;
    quantityBase: number;
    unitPrice: number;
    value: number;
  }[];
  totalValue: number;
};
type Customer = { id: string; code: string; name: string };
type Statement = {
  customer: { code: string; name: string };
  openReceivable: string;
  sales: { number: string; status: string; totalAmount: number; amountPaid: number; due: number }[];
};

async function download(path: string, token: string, filename: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { token } = useAuth();
  const [inv, setInv] = useState<InvReport | null>(null);
  const [top, setTop] = useState<{ sku: string; name: string; qty: number; revenue: number }[]>([]);
  const [profit, setProfit] = useState<Record<string, number> | null>(null);
  const [diffs, setDiffs] = useState<{ ok: boolean; differences: unknown[] } | null>(null);
  const [purchases, setPurchases] = useState<{ number: string; supplier: string; totalAmount: number }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api<InvReport>('/reports/inventory-valued', { token }),
      api<{ sku: string; name: string; qty: number; revenue: number }[]>('/reports/top-sellers', { token }),
      api<Record<string, number>>('/reports/profitability', { token }),
      api<{ ok: boolean; differences: unknown[] }>('/reports/inventory-differences', { token }),
      api<{ number: string; supplier: string; totalAmount: number }[]>('/reports/purchases-by-supplier', { token }),
      api<Customer[]>('/customers', { token }),
    ])
      .then(([i, t, p, d, pu, c]) => {
        setInv(i);
        setTop(t);
        setProfit(p);
        setDiffs(d);
        setPurchases(pu);
        setCustomers(c);
        if (c[0]) setCustomerId(c[0].id);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  async function loadStatement() {
    if (!token || !customerId) return;
    setStatement(
      await api<Statement>(`/reports/customer-statement/${customerId}`, { token }),
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Reportes</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() =>
              token &&
              download('/reports/export/inventory-valued.xlsx', token, 'inventario.xlsx').catch((e) =>
                setError(e.message),
              )
            }
          >
            Excel inventario
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              token &&
              download('/reports/export/inventory-valued.pdf', token, 'inventario.pdf').catch((e) =>
                setError(e.message),
              )
            }
          >
            PDF inventario
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              token &&
              download('/reports/export/top-sellers.xlsx', token, 'top.xlsx').catch((e) =>
                setError(e.message),
              )
            }
          >
            Excel más vendidos
          </Button>
          <Button
            variant="outlined"
            disabled={!customerId}
            onClick={() =>
              token &&
              customerId &&
              download(
                `/reports/export/customer-statement/${customerId}.pdf`,
                token,
                'estado-cuenta.pdf',
              ).catch((e) => setError(e.message))
            }
          >
            PDF estado de cuenta
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">
          Inventario valorizado — total ${inv?.totalValue.toFixed(2) ?? '…'}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Almacén</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(inv?.rows ?? []).slice(0, 20).map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.warehouse}</TableCell>
                <TableCell>{r.sku}</TableCell>
                <TableCell align="right">{r.quantityBase}</TableCell>
                <TableCell align="right">{r.value.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Más vendidos</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Ingresos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {top.map((r) => (
              <TableRow key={r.sku}>
                <TableCell>
                  {r.sku} — {r.name}
                </TableCell>
                <TableCell align="right">{r.qty}</TableCell>
                <TableCell align="right">{r.revenue.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Rentabilidad básica</Typography>
        {profit ? (
          <Typography>
            Ingresos cobrados: ${profit.revenue?.toFixed?.(2) ?? profit.revenue} · COGS est.: $
            {Number(profit.estimatedCogs).toFixed(2)} · Margen est.: $
            {Number(profit.grossMarginEstimate).toFixed(2)} (
            {Number(profit.marginPct).toFixed(1)}%) · Compras recibidas: $
            {Number(profit.purchaseCost).toFixed(2)}
          </Typography>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Compras / proveedores</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>OC</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.number}>
                <TableCell>{p.number}</TableCell>
                <TableCell>{p.supplier}</TableCell>
                <TableCell align="right">{p.totalAmount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6">Diferencias de inventario</Typography>
        <Typography color="text.secondary">
          {diffs?.ok
            ? 'Sin diferencias: saldos coinciden con movimientos.'
            : `${diffs?.differences.length ?? 0} diferencias detectadas`}
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Estado de cuenta del cliente
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Cliente"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            {customers.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.code} — {c.name}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={loadStatement}>
            Consultar
          </Button>
        </Stack>
        {statement ? (
          <>
            <Typography sx={{ mb: 1 }}>
              {statement.customer.code} — CxC abierta: ${statement.openReceivable}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Venta</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Pagado</TableCell>
                  <TableCell align="right">Saldo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {statement.sales.map((s) => (
                  <TableRow key={s.number}>
                    <TableCell>{s.number}</TableCell>
                    <TableCell>{s.status}</TableCell>
                    <TableCell align="right">{s.totalAmount}</TableCell>
                    <TableCell align="right">{s.amountPaid}</TableCell>
                    <TableCell align="right">{s.due}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </Paper>
    </Stack>
  );
}
