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
import { useBranch } from '../context/BranchContext';

type Warehouse = { id: string; code: string; name: string; branchId?: string | null };
type Product = { id: string; sku: string; name: string };
type Transfer = {
  id: string;
  number: string;
  status: string;
  fromWarehouse: { code: string };
  toWarehouse: { code: string };
  lines: { quantityBase: string; product: { sku: string } }[];
};

export function TransfersPage() {
  const { token } = useAuth();
  const { warehouseIds } = useBranch();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    const [w, p, t] = await Promise.all([
      api<Warehouse[]>('/warehouses', { token }),
      api<Product[]>('/products', { token }),
      api<Transfer[]>('/transfers', { token }),
    ]);
    setWarehouses(w);
    setProducts(p);
    setTransfers(t);
    const preferred = w.filter((x) => warehouseIds.includes(x.id));
    const list = preferred.length ? preferred : w;
    if (!fromId && list[0]) setFromId(list[0].id);
    if (!toId && w.find((x) => x.id !== list[0]?.id)) {
      setToId(w.find((x) => x.id !== list[0]?.id)!.id);
    }
    if (!productId && p[0]) setProductId(p[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, warehouseIds.join(',')]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const created = await api<Transfer>('/transfers', {
        method: 'POST',
        token,
        body: JSON.stringify({
          fromWarehouseId: fromId,
          toWarehouseId: toId,
          lines: [{ productId, quantityBase: Number(qty) }],
          notes: 'Transferencia UI',
        }),
      });
      const done = await api<Transfer>(`/transfers/${created.id}/complete`, {
        method: 'POST',
        token,
      });
      setMessage(`Transferencia ${done.number} completada`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Transferencias entre almacenes</Typography>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper
        component="form"
        onSubmit={onCreate}
        elevation={0}
        sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Origen"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
            fullWidth
            required
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.code} — {w.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Destino"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            fullWidth
            required
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.code} — {w.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Producto"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            fullWidth
            required
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.sku}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Cantidad base"
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
          <Button type="submit" variant="contained">
            Transferir
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Origen</TableCell>
              <TableCell>Destino</TableCell>
              <TableCell>Líneas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transfers.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.number}</TableCell>
                <TableCell>{t.status}</TableCell>
                <TableCell>{t.fromWarehouse.code}</TableCell>
                <TableCell>{t.toWarehouse.code}</TableCell>
                <TableCell>
                  {t.lines
                    .map((l) => `${l.product.sku}×${l.quantityBase}`)
                    .join(', ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
