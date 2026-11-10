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

type Warehouse = { id: string; code: string; name: string };
type Presentation = { id: string; name: string; factorToBase: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  presentations?: Presentation[];
};
type Balance = {
  id: string;
  quantityBase: string;
  product: Product;
  warehouse: Warehouse;
};

function stockLabel(quantityBase: string, presentations?: Presentation[]) {
  const qty = Number(quantityBase);
  const boxes = (presentations ?? [])
    .filter((p) => Number(p.factorToBase) > 1)
    .sort((a, b) => Number(b.factorToBase) - Number(a.factorToBase));
  if (!boxes.length || !Number.isFinite(qty)) return quantityBase;
  const factor = Number(boxes[0].factorToBase);
  const whole = Math.floor(qty / factor);
  const rest = Math.round((qty - whole * factor) * 1000) / 1000;
  const loose = rest > 0 ? ` + ${rest} u` : '';
  return `${qty} u · ${whole} ${boxes[0].name}${loose}`;
}
type Movement = {
  id: string;
  type: string;
  quantityBase: string;
  createdAt: string;
  notes: string | null;
  product: Product;
  warehouse: Warehouse;
};

export function InventoryPage() {
  const { token } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const [b, m, w, p] = await Promise.all([
      api<Balance[]>('/inventory/balances', { token }),
      api<Movement[]>('/inventory/movements', { token }),
      api<Warehouse[]>('/warehouses', { token }),
      api<Product[]>('/products', { token }),
    ]);
    setBalances(b);
    setMovements(m);
    setWarehouses(w);
    setProducts(p);
    if (!warehouseId && w[0]) setWarehouseId(w[0].id);
    if (!productId && p[0]) setProductId(p[0].id);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selected = products.find((p) => p.id === productId);
  const presentations = selected?.presentations ?? [];
  const presentation = presentations.find((p) => p.id === presentationId);
  const factor = presentation ? Number(presentation.factorToBase) : 1;

  async function onInitial(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/inventory/initial-stock', {
        method: 'POST',
        token,
        body: JSON.stringify({
          warehouseId,
          productId,
          quantityBase: Number(qty) * factor,
          notes: presentation
            ? `Entrada ${qty} × ${presentation.name}`
            : 'Entrada desde UI',
        }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Entrada de stock
        </Typography>
        <form onSubmit={onInitial}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Almacén"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Producto"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setPresentationId('');
              }}
              sx={{ flex: 1 }}
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Presentación"
              value={presentationId}
              onChange={(e) => setPresentationId(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Unidad base</MenuItem>
              {presentations.map((pr) => (
                <MenuItem key={pr.id} value={pr.id}>
                  {pr.name} (×{Number(pr.factorToBase)})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={presentation ? `Cantidad de ${presentation.name}` : 'Cantidad'}
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              sx={{ width: 180 }}
              helperText={`${Number(qty) || 0} × ${factor} = ${(Number(qty) || 0) * factor} u`}
            />
            <Button type="submit" variant="contained">
              Registrar
            </Button>
          </Stack>
        </form>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Saldos generales
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Almacén</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Cantidad</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.warehouse.code}</TableCell>
                <TableCell>
                  {b.product.sku} — {b.product.name}
                </TableCell>
                <TableCell align="right">
                  {stockLabel(b.quantityBase, b.product.presentations)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Movimientos recientes
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Δ base</TableCell>
              <TableCell>Notas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                <TableCell>{m.type}</TableCell>
                <TableCell>{m.product.sku}</TableCell>
                <TableCell align="right">{m.quantityBase}</TableCell>
                <TableCell>{m.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
