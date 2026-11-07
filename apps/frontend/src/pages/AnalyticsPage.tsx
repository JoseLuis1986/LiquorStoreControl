import { useEffect, useState } from 'react';
import {
  Alert,
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

type Trends = {
  days: number;
  series: {
    date: string;
    salesAmount: number;
    salesCount: number;
    consumptionQty: number;
  }[];
  rotation: {
    sku: string;
    name: string;
    soldQty: number;
    stockQty: number;
    turns: number;
  }[];
  totals: {
    salesAmount: number;
    salesCount: number;
    consumptionQty: number;
  };
};

export function AnalyticsPage() {
  const { token } = useAuth();
  const { branchId } = useBranch();
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const q = new URLSearchParams({ days: String(days) });
    if (branchId) q.set('branchId', branchId);
    api<Trends>(`/analytics/trends?${q}`, { token })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, days, branchId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>Cargando analítica…</Typography>;

  const maxSales = Math.max(...data.series.map((s) => s.salesAmount), 1);
  const maxCons = Math.max(...data.series.map((s) => s.consumptionQty), 1);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="h4">Analítica / tendencias</Typography>
        <TextField
          select
          size="small"
          label="Ventana"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          sx={{ minWidth: 140 }}
        >
          {[7, 14, 30, 60].map((d) => (
            <MenuItem key={d} value={d}>
              {d} días
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Ventas (periodo)
          </Typography>
          <Typography variant="h4">${data.totals.salesAmount.toFixed(2)}</Typography>
          <Typography variant="body2">{data.totals.salesCount} tickets</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary">
            Consumo (u. base)
          </Typography>
          <Typography variant="h4">{data.totals.consumptionQty.toFixed(1)}</Typography>
        </Paper>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Serie diaria
        </Typography>
        <Stack spacing={1}>
          {data.series.map((s) => (
            <Stack key={s.date} direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" sx={{ width: 88 }}>
                {s.date.slice(5)}
              </Typography>
              <div
                title={`Ventas $${s.salesAmount.toFixed(2)}`}
                style={{
                  height: 10,
                  width: `${Math.max(4, (s.salesAmount / maxSales) * 100)}%`,
                  maxWidth: '45%',
                  background: '#1b4332',
                  borderRadius: 4,
                }}
              />
              <div
                title={`Consumo ${s.consumptionQty}`}
                style={{
                  height: 10,
                  width: `${Math.max(4, (s.consumptionQty / maxCons) * 100)}%`,
                  maxWidth: '45%',
                  background: '#bc6c25',
                  borderRadius: 4,
                }}
              />
            </Stack>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Verde = ventas · Terracota = consumo
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Rotación (aprox. sold / avg stock)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Vendido</TableCell>
              <TableCell align="right">Stock</TableCell>
              <TableCell align="right">Turns</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.rotation.map((r) => (
              <TableRow key={r.sku}>
                <TableCell>{r.sku}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right">{r.soldQty}</TableCell>
                <TableCell align="right">{r.stockQty}</TableCell>
                <TableCell align="right">{r.turns}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
