import { FormEvent, useEffect, useState } from 'react';
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

type Allocation = {
  id: string;
  status: string;
  customer: { id: string; name: string; code: string };
  warehouse: { id: string; code: string };
  lines: { productId: string; quantityBase: string; product: { sku: string } }[];
};
type Sale = {
  id: string;
  number: string | null;
  status: string;
  warehouseId: string | null;
  customer?: { id: string; name: string } | null;
  lines: { productId: string; quantityBase: string; product: { sku: string } }[];
};
type StockReturn = {
  id: string;
  number: string;
  type: string;
  totalCredit: string;
  reason: string | null;
  customer?: { name: string } | null;
};

export function ReturnsPage() {
  const { token } = useAuth();
  const [type, setType] = useState<'ALLOCATION' | 'SALE'>('ALLOCATION');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [allocationId, setAllocationId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('Devolución cliente');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const [a, s, r] = await Promise.all([
      api<Allocation[]>('/allocations', { token }),
      api<Sale[]>('/sales', { token }),
      api<StockReturn[]>('/returns', { token }),
    ]);
    setAllocations(a.filter((x) => x.status === 'COMPLETED'));
    setSales(s.filter((x) => x.status !== 'CANCELLED' && x.status !== 'VOID'));
    setReturns(r);
    if (!allocationId && a[0]) setAllocationId(a[0].id);
    if (!saleId && s[0]) setSaleId(s[0].id);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      if (type === 'ALLOCATION') {
        const alloc = allocations.find((a) => a.id === allocationId);
        if (!alloc) throw new Error('Selecciona asignación');
        const line = alloc.lines[0];
        const ret = await api<StockReturn>('/returns', {
          method: 'POST',
          token,
          body: JSON.stringify({
            type: 'ALLOCATION',
            warehouseId: alloc.warehouse.id,
            customerId: alloc.customer.id,
            allocationId: alloc.id,
            reason,
            lines: [
              {
                productId: line.productId,
                quantityBase: Number(qty),
              },
            ],
          }),
        });
        setMsg(`Devolución ${ret.number} · crédito ${ret.totalCredit}`);
      } else {
        const sale = sales.find((s) => s.id === saleId);
        if (!sale?.warehouseId) throw new Error('Venta sin almacén');
        const line = sale.lines[0];
        const ret = await api<StockReturn>('/returns', {
          method: 'POST',
          token,
          body: JSON.stringify({
            type: 'SALE',
            warehouseId: sale.warehouseId,
            saleId: sale.id,
            customerId: sale.customer?.id,
            reason,
            lines: [
              {
                productId: line.productId,
                quantityBase: Number(qty),
              },
            ],
          }),
        });
        setMsg(`Devolución ${ret.number} · crédito ${ret.totalCredit}`);
        // open receipt
        const html = await fetch(
          `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/receipts/returns/${ret.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).then((r) => r.text());
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Nueva devolución
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          No se editan movimientos: se generan reversiones inmutables y se
          reintegra saldo/existencias según el tipo.
        </Typography>
        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              select
              label="Tipo"
              value={type}
              onChange={(e) => setType(e.target.value as 'ALLOCATION' | 'SALE')}
              sx={{ maxWidth: 280 }}
            >
              <MenuItem value="ALLOCATION">Asignación (cliente)</MenuItem>
              <MenuItem value="SALE">Venta</MenuItem>
            </TextField>
            {type === 'ALLOCATION' ? (
              <TextField
                select
                label="Asignación"
                value={allocationId}
                onChange={(e) => setAllocationId(e.target.value)}
              >
                {allocations.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.customer.code} · {a.lines.map((l) => l.product.sku).join(', ')} ·{' '}
                    {a.warehouse.code}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                select
                label="Venta"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              >
                {sales.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.number} · {s.customer?.name ?? 'Mostrador'} · {s.status}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Cantidad base (1ª línea)"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                sx={{ width: 180 }}
              />
              <TextField
                label="Motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="contained">
                Registrar
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Historial de devoluciones
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell align="right">Crédito</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.number}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>{r.customer?.name ?? '—'}</TableCell>
                <TableCell align="right">{r.totalCredit}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={async () => {
                      const html = await fetch(
                        `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/receipts/returns/${r.id}`,
                        { headers: { Authorization: `Bearer ${token}` } },
                      ).then((res) => res.text());
                      const w = window.open('', '_blank');
                      if (w) {
                        w.document.write(html);
                        w.document.close();
                      }
                    }}
                  >
                    Comprobante
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
