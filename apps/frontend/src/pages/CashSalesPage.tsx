import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Link,
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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

type Warehouse = { id: string; code: string };
type Product = { id: string; sku: string; name: string; defaultUnitPrice: string };
type Customer = { id: string; code: string; name: string };
type CashSession = {
  id: string;
  status: string;
  openingFloat: string;
  warehouse: Warehouse;
};
type Sale = {
  id: string;
  number: string | null;
  status: string;
  totalAmount: string;
  amountPaid: string;
  trigger: string;
  customer?: Customer | null;
  payments: { id: string; method: string; amount: string }[];
};

export function CashSalesPage() {
  const { token } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [session, setSession] = useState<CashSession | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ar, setAr] = useState<Sale[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [qty, setQty] = useState('1');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [openingFloat, setOpeningFloat] = useState('500');
  const [closingAmount, setClosingAmount] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const [w, p, c, s, salesList, arList] = await Promise.all([
      api<Warehouse[]>('/warehouses', { token }),
      api<Product[]>('/products', { token }),
      api<Customer[]>('/customers', { token }),
      api<{ session: CashSession | null }>(
        `/cash-sessions/current${warehouseId ? `?warehouseId=${warehouseId}` : ''}`,
        { token },
      ),
      api<Sale[]>('/sales', { token }),
      api<Sale[]>('/sales?arOnly=true', { token }),
    ]);
    setWarehouses(w);
    setProducts(p);
    setCustomers(c);
    setSession(s.session);
    setSales(salesList);
    setAr(arList);
    if (!warehouseId && w[0]) setWarehouseId(w[0].id);
    if (!productId && p[0]) setProductId(p[0].id);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, warehouseId]);

  async function openCash() {
    setError(null);
    try {
      await api('/cash-sessions/open', {
        method: 'POST',
        token,
        body: JSON.stringify({
          warehouseId,
          openingFloat: Number(openingFloat),
        }),
      });
      setMsg('Caja abierta');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function closeCash() {
    if (!session) return;
    setError(null);
    try {
      await api(`/cash-sessions/${session.id}/close`, {
        method: 'POST',
        token,
        body: JSON.stringify({ closingAmount: Number(closingAmount) }),
      });
      setMsg('Caja cerrada');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function createSale(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const sale = await api<Sale>('/sales', {
        method: 'POST',
        token,
        body: JSON.stringify({
          warehouseId,
          customerId: customerId || undefined,
          cashSessionId: session?.id,
          lines: [{ productId, quantityBase: Number(qty) }],
          paymentMethod: payMethod,
          paymentAmount: Number(payAmount || 0) || undefined,
        }),
      });
      setMsg(`Venta ${sale.number} · ${sale.status}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function payAr(saleId: string) {
    const amount = prompt('Monto del abono');
    if (!amount) return;
    await api(`/sales/${saleId}/payments`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        method: payMethod,
        amount: Number(amount),
        cashSessionId: session?.id,
      }),
    });
    await reload();
  }

  function receiptUrl(saleId: string) {
    return `${API_BASE}/receipts/sales/${saleId}`;
  }

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Caja
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            select
            label="Almacén"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            {warehouses.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.code}
              </MenuItem>
            ))}
          </TextField>
          {session?.status === 'OPEN' ? (
            <>
              <Typography>
                Abierta · fondo {session.openingFloat} ({session.warehouse.code})
              </Typography>
              <TextField
                label="Conteo cierre"
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                sx={{ width: 140 }}
              />
              <Button variant="outlined" color="warning" onClick={closeCash}>
                Cerrar caja
              </Button>
            </>
          ) : (
            <>
              <TextField
                label="Fondo inicial"
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                sx={{ width: 140 }}
              />
              <Button variant="contained" onClick={openCash}>
                Abrir caja
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Venta de mostrador
        </Typography>
        <form onSubmit={createSale}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              select
              label="Cliente (opc.)"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Mostrador</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Producto"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {products.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.sku} (${p.defaultUnitPrice})
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Cant." type="number" value={qty} onChange={(e) => setQty(e.target.value)} sx={{ width: 100 }} />
            <TextField
              select
              label="Pago"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="CASH">Efectivo</MenuItem>
              <MenuItem value="CARD">Tarjeta</MenuItem>
              <MenuItem value="TRANSFER">Transferencia</MenuItem>
            </TextField>
            <TextField
              label="Monto pago"
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="vacío = CxC"
              sx={{ width: 140 }}
            />
            <Button type="submit" variant="contained">
              Registrar venta
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Cuentas por cobrar
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Venta</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Pagado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {ar.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.number}</TableCell>
                <TableCell>{s.customer?.name ?? '—'}</TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell align="right">{s.totalAmount}</TableCell>
                <TableCell align="right">{s.amountPaid}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => payAr(s.id)}>
                    Abonar
                  </Button>
                  <Link
                    href={receiptUrl(s.id)}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ ml: 1 }}
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(
                        receiptUrl(s.id),
                        '_blank',
                        // token via temporary approach: fetch blob
                      );
                      // open with auth header via fetch
                      void (async () => {
                        const html = await fetch(receiptUrl(s.id), {
                          headers: { Authorization: `Bearer ${token}` },
                        }).then((r) => r.text());
                        const w = window.open('', '_blank');
                        if (w) {
                          w.document.write(html);
                          w.document.close();
                        }
                      })();
                    }}
                  >
                    Comprobante
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Ventas recientes
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Número</TableCell>
              <TableCell>Trigger</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Pagado</TableCell>
              <TableCell>Comprobante</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.slice(0, 20).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.number}</TableCell>
                <TableCell>{s.trigger}</TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell align="right">{s.totalAmount}</TableCell>
                <TableCell align="right">{s.amountPaid}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={async () => {
                      const html = await fetch(receiptUrl(s.id), {
                        headers: { Authorization: `Bearer ${token}` },
                      }).then((r) => r.text());
                      const w = window.open('', '_blank');
                      if (w) {
                        w.document.write(html);
                        w.document.close();
                      }
                    }}
                  >
                    Imprimir
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
