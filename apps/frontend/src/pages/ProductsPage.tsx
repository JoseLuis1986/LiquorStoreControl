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

type Unit = { id: string; code: string; name: string };
type Category = { id: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  modality: string;
  active: boolean;
  baseUnit?: Unit;
  category?: Category | null;
  presentations?: { name: string; factorToBase: string }[];
};

export function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  async function reload() {
    if (!token) return;
    const [p, u, c] = await Promise.all([
      api<Product[]>('/products', { token }),
      api<Unit[]>('/units', { token }),
      api<Category[]>('/categories', { token }),
    ]);
    setProducts(p);
    setUnits(u);
    setCategories(c);
    if (!baseUnitId && u[0]) setBaseUnitId(u[0].id);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/products', {
        method: 'POST',
        token,
        body: JSON.stringify({
          sku,
          name,
          baseUnitId,
          categoryId: categoryId || undefined,
        }),
      });
      setSku('');
      setName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Nuevo producto
        </Typography>
        <form onSubmit={onCreate}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="Unidad base"
              value={baseUnitId}
              onChange={(e) => setBaseUnitId(e.target.value)}
              required
              sx={{ minWidth: 140 }}
            >
              {units.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Categoría"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">—</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained">
              Crear
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
          Catálogo
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Categoría</TableCell>
              <TableCell>Unidad</TableCell>
              <TableCell>Presentaciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.sku}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.category?.name ?? '—'}</TableCell>
                <TableCell>{p.baseUnit?.code}</TableCell>
                <TableCell>
                  {(p.presentations ?? [])
                    .map((x) => `${x.name} (×${x.factorToBase})`)
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
