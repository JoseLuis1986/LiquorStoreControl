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

type Supplier = { id: string; code: string; name: string };
type Warehouse = { id: string; code: string };
type Product = { id: string; sku: string; name: string };
type Order = {
  id: string;
  number: string;
  status: string;
  totalAmount: string;
  supplier?: Supplier | null;
  warehouse: Warehouse;
  lines: { quantityBase: string; unitCost: string; product: Product }[];
};

export function PurchasesPage() {
  const { token } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('24');
  const [unitCost, setUnitCost] = useState('280');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const [s, w, p, o] = await Promise.all([
      api<Supplier[]>('/suppliers', { token }),
      api<Warehouse[]>('/warehouses', { token }),
      api<Product[]>('/products', { token }),
      api<Order[]>('/orders', { token }),
    ]);
    setSuppliers(s);
    setWarehouses(w);
    setProducts(p);
    setOrders(o);
    if (!supplierId && s[0]) setSupplierId(s[0].id);
    if (!warehouseId && w[0]) setWarehouseId(w[0].id);
    if (!productId && p[0]) setProductId(p[0].id);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createSupplier(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/suppliers', {
        method: 'POST',
        token,
        body: JSON.stringify({ code: supCode, name: supName }),
      });
      setSupCode('');
      setSupName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const order = await api<Order>('/orders', {
        method: 'POST',
        token,
        body: JSON.stringify({
          warehouseId,
          supplierId: supplierId || undefined,
          lines: [
            {
              productId,
              quantityBase: Number(qty),
              unitCost: Number(unitCost),
            },
          ],
        }),
      });
      setMsg(`OC ${order.number} creada (${order.status})`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function confirm(id: string) {
    await api(`/orders/${id}/confirm`, { method: 'POST', token });
    await reload();
  }

  async function receive(id: string) {
    setMsg(null);
    const order = await api<Order>(`/orders/${id}/receive`, {
      method: 'POST',
      token,
    });
    setMsg(`Recepción ${order.number}: inventario actualizado`);
    await reload();
  }

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Proveedor
        </Typography>
        <form onSubmit={createSupplier}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Código" value={supCode} onChange={(e) => setSupCode(e.target.value)} required />
            <TextField label="Nombre" value={supName} onChange={(e) => setSupName(e.target.value)} required sx={{ flex: 1 }} />
            <Button type="submit" variant="outlined">
              Crear proveedor
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Orden de compra
        </Typography>
        <form onSubmit={createOrder}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField select label="Proveedor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} sx={{ minWidth: 180 }}>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Almacén" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} sx={{ minWidth: 140 }}>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="Producto" value={productId} onChange={(e) => setProductId(e.target.value)} sx={{ minWidth: 200 }}>
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.sku}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Cant. base" type="number" value={qty} onChange={(e) => setQty(e.target.value)} sx={{ width: 120 }} />
            <TextField label="Costo u." type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} sx={{ width: 120 }} />
            <Button type="submit" variant="contained">
              Crear OC
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Órdenes
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.number}</TableCell>
                <TableCell>{o.supplier?.name ?? '—'}</TableCell>
                <TableCell>{o.status}</TableCell>
                <TableCell align="right">{o.totalAmount}</TableCell>
                <TableCell>
                  {o.status === 'DRAFT' ? (
                    <Button size="small" onClick={() => confirm(o.id)}>
                      Confirmar
                    </Button>
                  ) : null}
                  {o.status === 'DRAFT' || o.status === 'CONFIRMED' ? (
                    <Button size="small" onClick={() => receive(o.id)}>
                      Recibir
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
