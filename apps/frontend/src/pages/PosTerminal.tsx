import { FormEvent, useEffect, useRef, useState } from 'react';
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
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { enqueueOfflineOp } from '../offline/queue';
import { attachKeyboardWedgeListener } from '../peripherals/scanner';
import { getPrinterCapabilities } from '../peripherals/printer';

type ResolveResult = {
  card: { id: string; status: string; label: string | null };
  customer: {
    id: string;
    code: string;
    name: string;
    billingModes: string[];
  };
  allocationBalances: {
    id: string;
    quantityBase: string;
    quantityAssigned: string;
    quantityConsumed: string;
    quantityReturned: string;
    product: { id: string; sku: string; name: string };
    warehouse: { id: string; code: string; name: string };
  }[];
};

type Warehouse = { id: string; code: string; name: string };
type Product = {
  id: string;
  sku: string;
  name: string;
  presentations?: { id: string; name: string; factorToBase: string }[];
};

export function PosTerminal() {
  const { token } = useAuth();
  const { branchId, warehouseIds } = useBranch();
  const online = useOnlineStatus();
  const [cardToken, setCardToken] = useState('');
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [allocQty, setAllocQty] = useState('1');
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeProductId, setConsumeProductId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const printerCaps = getPrinterCapabilities();

  useEffect(() => {
    if (!token) return;
    const q = branchId ? `?branchId=${branchId}` : '';
    Promise.all([
      api<Warehouse[]>(`/warehouses${q}`, { token }),
      api<Product[]>('/products', { token }),
    ])
      .then(([w, p]) => {
        const filtered =
          warehouseIds.length > 0
            ? w.filter((x) => warehouseIds.includes(x.id))
            : w;
        const list = filtered.length ? filtered : w;
        setWarehouses(list);
        setProducts(p);
        if (list[0]) setWarehouseId(list[0].id);
        if (p[0]) setProductId(p[0].id);
      })
      .catch((e) => setError(e.message));
  }, [token, branchId, warehouseIds.join(',')]);

  useEffect(() => {
    return attachKeyboardWedgeListener(document, (code) => {
      setCardToken(code);
      setMessage(`Escaneo wedge: ${code.slice(0, 12)}…`);
      tokenInputRef.current?.focus();
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const presentations = selectedProduct?.presentations ?? [];

  async function onResolve(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const data = await api<ResolveResult>('/cards/resolve', {
        method: 'POST',
        token,
        body: JSON.stringify({ token: cardToken.trim() }),
      });
      setResolved(data);
      if (data.allocationBalances[0]) {
        setConsumeProductId(data.allocationBalances[0].product.id);
        setWarehouseId(data.allocationBalances[0].warehouse.id);
      }
      setMessage(`Cliente: ${data.customer.name} (${data.customer.code})`);
    } catch (err) {
      setResolved(null);
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function onAllocate() {
    if (!resolved) return;
    setError(null);
    setMessage(null);
    try {
      await api('/allocations', {
        method: 'POST',
        token,
        body: JSON.stringify({
          customerId: resolved.customer.id,
          warehouseId,
          lines: [
            {
              productId,
              presentationId: presentationId || undefined,
              quantity: Number(allocQty),
            },
          ],
          notes: 'Asignación desde POS',
        }),
      });
      setMessage('Asignación registrada (stock general descontado).');
      // refrescar saldos
      const data = await api<ResolveResult>('/cards/resolve', {
        method: 'POST',
        token,
        body: JSON.stringify({ token: cardToken.trim() }),
      });
      setResolved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function onConsume() {
    if (!resolved) return;
    setError(null);
    setMessage(null);
    const idem = crypto.randomUUID();
    const body = {
      customerId: resolved.customer.id,
      warehouseId,
      lines: [
        {
          productId: consumeProductId,
          quantityBase: Number(consumeQty),
        },
      ],
    };

    if (!online) {
      await enqueueOfflineOp({
        id: crypto.randomUUID(),
        type: 'consumption',
        path: '/consumptions',
        method: 'POST',
        body,
        idempotencyKey: idem,
      });
      setMessage(
        `Offline: consumo encolado (idem ${idem.slice(0, 8)}…). Se reenviará al reconectar.`,
      );
      return;
    }

    try {
      const result = await api<{
        replay: boolean;
        consumption: { id: string };
      }>('/consumptions', {
        method: 'POST',
        token,
        idempotencyKey: idem,
        body: JSON.stringify(body),
      });
      setMessage(
        result.replay
          ? `Consumo idempotente (replay) ${result.consumption.id}`
          : `Consumo registrado ${result.consumption.id}`,
      );
      const data = await api<ResolveResult>('/cards/resolve', {
        method: 'POST',
        token,
        body: JSON.stringify({ token: cardToken.trim() }),
      });
      setResolved(data);
    } catch (err) {
      if (!navigator.onLine) {
        await enqueueOfflineOp({
          id: crypto.randomUUID(),
          type: 'consumption',
          path: '/consumptions',
          method: 'POST',
          body,
          idempotencyKey: idem,
        });
        setMessage('Red caída: consumo encolado para replay idempotente.');
        return;
      }
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          Terminal POS / escaneo
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Escanea (keyboard wedge) o pega el token de la tarjeta (sin PII). Luego
          asigna o registra consumo. Offline: los consumos se encolan con
          Idempotency-Key. Impresión: {printerCaps.browserPrint ? 'navegador' : 'n/d'}
          {printerCaps.webSerial ? ' + Web Serial' : ''}.
        </Typography>
        {!online ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Modo offline — los consumos quedan en cola local hasta reconectar.
          </Alert>
        ) : null}
        <form onSubmit={onResolve}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Token de tarjeta"
              value={cardToken}
              onChange={(e) => setCardToken(e.target.value)}
              inputRef={tokenInputRef}
              fullWidth
              autoFocus
              required
            />
            <Button type="submit" variant="contained">
              Resolver
            </Button>
          </Stack>
        </form>
        {message ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </Paper>

      {resolved ? (
        <>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Saldos asignados (assigned − consumed − returned)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Almacén</TableCell>
                  <TableCell align="right">Asignado</TableCell>
                  <TableCell align="right">Consumido</TableCell>
                  <TableCell align="right">Devuelto</TableCell>
                  <TableCell align="right">Restante</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resolved.allocationBalances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>Sin saldo asignado</TableCell>
                  </TableRow>
                ) : (
                  resolved.allocationBalances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.product.sku} — {b.product.name}
                      </TableCell>
                      <TableCell>{b.warehouse.code}</TableCell>
                      <TableCell align="right">{b.quantityAssigned}</TableCell>
                      <TableCell align="right">{b.quantityConsumed}</TableCell>
                      <TableCell align="right">{b.quantityReturned}</TableCell>
                      <TableCell align="right">{b.quantityBase}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Asignar (descuenta inventario general)
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
                    {p.sku}
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
                    {pr.name} (×{pr.factorToBase})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Cantidad"
                type="number"
                value={allocQty}
                onChange={(e) => setAllocQty(e.target.value)}
                sx={{ width: 120 }}
              />
              <Button variant="contained" onClick={onAllocate}>
                Asignar
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Registrar consumo (idempotente)
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="Producto con saldo"
                value={consumeProductId}
                onChange={(e) => setConsumeProductId(e.target.value)}
                sx={{ flex: 1 }}
              >
                {resolved.allocationBalances.map((b) => (
                  <MenuItem key={b.id} value={b.product.id}>
                    {b.product.sku} (restante {b.quantityBase})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Cantidad base"
                type="number"
                value={consumeQty}
                onChange={(e) => setConsumeQty(e.target.value)}
                sx={{ width: 140 }}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={onConsume}
                disabled={!consumeProductId}
              >
                Consumir
              </Button>
            </Stack>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
