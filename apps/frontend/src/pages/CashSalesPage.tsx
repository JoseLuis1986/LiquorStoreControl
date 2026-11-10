import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { API_BASE, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useExchange } from '../context/ExchangeContext';
import { newId } from '../id';

type Warehouse = { id: string; code: string };
type Presentation = { id: string; name: string; factorToBase: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  defaultUnitPrice: string;
  presentations?: Presentation[];
};
type CardRef = { id: string; status: string; label: string | null };
type Customer = {
  id: string;
  code: string;
  name: string;
  cards?: CardRef[];
};
type CashSession = {
  id: string;
  status: string;
  openingFloat: string;
  warehouse: Warehouse;
};
type SaleLine = {
  id: string;
  fulfillment: 'TAKEAWAY' | 'ON_PREMISE';
  quantityBase: string;
  lineTotal: string;
  product: { name: string };
  presentation?: { name: string } | null;
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
  lines?: SaleLine[];
};
type CartLine = {
  key: string;
  productId: string;
  name: string;
  presentationId: string;
  presentationName: string;
  factor: number;
  qty: number;
  unitPrice: number;
  fulfillment: 'TAKEAWAY' | 'ON_PREMISE';
};

export function CashSalesPage() {
  const { token } = useAuth();
  const { money } = useExchange();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [session, setSession] = useState<CashSession | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ar, setAr] = useState<Sale[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [lineFulfillment, setLineFulfillment] = useState<'TAKEAWAY' | 'ON_PREMISE'>('TAKEAWAY');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [qty, setQty] = useState('1');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payAmount, setPayAmount] = useState('');
  const [openingFloat, setOpeningFloat] = useState('500');
  const [closingAmount, setClosingAmount] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ number: string; html: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

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

  const selected = products.find((p) => p.id === productId);
  const presentations = selected?.presentations ?? [];
  const presentation = presentations.find((p) => p.id === presentationId);
  const factor = presentation ? Number(presentation.factorToBase) : 1;
  const units = (Number(qty) || 0) * factor;
  const previewTotal = units * Number(selected?.defaultUnitPrice ?? 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.qty * line.factor * line.unitPrice, 0);
  const needsCard = cart.some((line) => line.fulfillment === 'ON_PREMISE');

  function addToCart() {
    setError(null);
    if (!selected || !(Number(qty) > 0)) {
      setError('Elige producto y cantidad.');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: newId(),
        productId: selected.id,
        name: selected.name,
        presentationId,
        presentationName: presentation?.name ?? 'Unidad',
        factor,
        qty: Number(qty),
        unitPrice: Number(selected.defaultUnitPrice),
        fulfillment: lineFulfillment,
      },
    ]);
    setQty('1');
  }

  async function createSale(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!cart.length) {
      setError('Agrega al menos un producto al pedido.');
      return;
    }
    if (needsCard && !customerId) {
      setError('Hay productos para consumir en el local. Elige la tarjeta del cliente.');
      return;
    }
    try {
      const sale = await api<Sale>('/sales', {
        method: 'POST',
        token,
        body: JSON.stringify({
          warehouseId,
          customerId: customerId || undefined,
          cashSessionId: session?.id,
          lines: cart.map((line) => ({
            productId: line.productId,
            ...(line.presentationId
              ? { presentationId: line.presentationId, quantity: line.qty }
              : { quantityBase: line.qty }),
            fulfillment: line.fulfillment,
          })),
          paymentMethod: payMethod,
          paymentAmount: Number(payAmount || 0) || undefined,
        }),
      });
      const delivered = cart.filter((line) => line.fulfillment === 'TAKEAWAY').length;
      const onCard = cart.filter((line) => line.fulfillment === 'ON_PREMISE').length;
      setCart([]);
      setMsg(
        `Venta ${sale.number}. Entregados ahora: ${delivered}. En la tarjeta, para despachar por partes: ${onCard}.`,
      );
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

  async function viewReceipt(sale: Sale) {
    setError(null);
    const res = await fetch(receiptUrl(sale.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError(`No se pudo cargar el comprobante (${res.status})`);
      return;
    }
    setReceipt({ number: sale.number ?? sale.id.slice(0, 8), html: await res.text() });
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <TextField
            select
            label="Producto"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setPresentationId('');
            }}
            sx={{ minWidth: 220 }}
          >
            {products.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                  {p.name} ({money(p.defaultUnitPrice)})
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
            <MenuItem value="">Unidad</MenuItem>
            {presentations.map((pr) => (
              <MenuItem key={pr.id} value={pr.id}>
                {pr.name} (×{Number(pr.factorToBase)})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Cant."
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            sx={{ width: 100 }}
            helperText={`${units} u · ${money(previewTotal)}`}
          />
          <TextField
            select
            label="Entrega de este producto"
            value={lineFulfillment}
            onChange={(e) => setLineFulfillment(e.target.value as 'TAKEAWAY' | 'ON_PREMISE')}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="TAKEAWAY">Despachar ahora</MenuItem>
            <MenuItem value="ON_PREMISE">Dejar en la tarjeta</MenuItem>
          </TextField>
          <Button variant="outlined" onClick={addToCart} sx={{ alignSelf: 'center' }}>
            Agregar al pedido
          </Button>
        </Stack>
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Presentación</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Importe</TableCell>
              <TableCell>Entrega</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {cart.map((line) => (
              <TableRow key={line.key}>
                <TableCell>{line.name}</TableCell>
                <TableCell>{line.presentationName}</TableCell>
                <TableCell align="right">{line.qty}</TableCell>
                <TableCell align="right">{money(line.qty * line.factor * line.unitPrice)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={line.fulfillment === 'TAKEAWAY' ? 'success' : 'warning'}
                    label={line.fulfillment === 'TAKEAWAY' ? 'Se entrega ahora' : 'Queda en la tarjeta'}
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => setCart((prev) => prev.filter((item) => item.key !== line.key))}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!cart.length && (
              <TableRow>
                <TableCell colSpan={6}>El pedido está vacío. Agrega los productos y luego cobra.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Typography sx={{ mb: 2 }}>Total del pedido: {money(cartTotal)}</Typography>
        <form onSubmit={createSale}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
            <TextField
              select
              label={needsCard ? 'Tarjeta del cliente' : 'Cliente (opc.)'}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              sx={{ minWidth: 220 }}
              required={needsCard}
            >
              <MenuItem value="">{needsCard ? 'Elegir tarjeta' : 'Mostrador'}</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </MenuItem>
              ))}
            </TextField>
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
            <Button type="submit" variant="contained" disabled={!cart.length}>
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
              <TableCell>Cliente / tarjeta</TableCell>
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
                <TableCell>
                  <AssignedCard sale={s} />
                </TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell align="right">{money(s.totalAmount)}</TableCell>
                <TableCell align="right">{money(s.amountPaid)}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => payAr(s.id)}>
                    Abonar
                  </Button>
                  <Button size="small" onClick={() => void viewReceipt(s)}>
                    Ver comprobante
                  </Button>
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
              <TableCell>Cliente / tarjeta</TableCell>
              <TableCell>Entrega</TableCell>
              <TableCell>Comprobante</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.slice(0, 20).map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.number}</TableCell>
                <TableCell>{s.trigger}</TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell align="right">{money(s.totalAmount)}</TableCell>
                <TableCell align="right">{money(s.amountPaid)}</TableCell>
                <TableCell>
                  <AssignedCard sale={s} />
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    {(s.lines ?? []).map((line) => (
                      <Chip
                        key={line.id}
                        size="small"
                        color={line.fulfillment === 'TAKEAWAY' ? 'success' : 'warning'}
                        label={`${line.product.name}: ${
                          line.fulfillment === 'TAKEAWAY' ? 'Entregado' : 'En tarjeta'
                        }`}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => void viewReceipt(s)}>
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!receipt} onClose={() => setReceipt(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Comprobante {receipt?.number}</DialogTitle>
        <DialogContent>
          <iframe
            ref={frameRef}
            title="Comprobante"
            srcDoc={receipt?.html ?? ''}
            style={{ width: '100%', height: 560, border: '1px solid #ddd', background: '#fff' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceipt(null)}>Cerrar</Button>
          <Button
            variant="contained"
            onClick={() => frameRef.current?.contentWindow?.print()}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function AssignedCard({ sale }: { sale: Sale }) {
  const pending = (sale.lines ?? []).some((line) => line.fulfillment === 'ON_PREMISE');
  if (!pending) {
    return <>{sale.customer ? `${sale.customer.name} (${sale.customer.code})` : 'Mostrador'}</>;
  }
  const card = sale.customer?.cards?.find((item) => item.status === 'ACTIVE');
  if (!sale.customer) return <>Sin cliente</>;
  return (
    <Stack spacing={0.25}>
      <span>
        {sale.customer.name} ({sale.customer.code})
      </span>
      <Typography variant="caption" color="text.secondary">
        {card ? 'Tarjeta activa' : 'Sin tarjeta activa'}
        {card?.label ? ` · ${card.label}` : ''}
      </Typography>
    </Stack>
  );
}
