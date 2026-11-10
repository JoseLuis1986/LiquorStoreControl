import { FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import jsQR from 'jsqr';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { newId } from '../id';
import { ActiveServices, MyDispatches } from './ServiceActivity';

type Balance = {
  id: string;
  quantityBase: string;
  quantityAssigned: string;
  quantityConsumed: string;
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; code: string; name: string };
};

type CustomerInfo = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
};

type ResolveResult = {
  card: { id: string; label: string | null };
  customer: CustomerInfo;
  allocationBalances: Balance[];
};

type DeskEntry = ResolveResult & { raw: string };

const DESK_KEY = 'liquorcontrol.waiterDesk';

function parseDesk(raw: string | null): DeskEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DeskEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** La lista local gana en saldos; se conservan las tarjetas que solo están en la otra. */
function mergeDesk(primary: DeskEntry[], extra: DeskEntry[]): DeskEntry[] {
  const ids = new Set(primary.map((item) => item.customer.id));
  return [...primary, ...extra.filter((item) => !ids.has(item.customer.id))];
}

function loadDesk(): DeskEntry[] {
  const fromLocal = parseDesk(localStorage.getItem(DESK_KEY));
  const fromSession = parseDesk(sessionStorage.getItem(DESK_KEY));
  if (fromSession.length) sessionStorage.removeItem(DESK_KEY);
  return mergeDesk(fromLocal, fromSession);
}

function remaining(entry: DeskEntry) {
  return entry.allocationBalances.reduce((sum, b) => sum + Number(b.quantityBase), 0);
}

export function ServicePage() {
  const { token } = useAuth();
  const { lastEvents } = useRealtime(true);
  const [params] = useSearchParams();
  const cardFromLink = params.get('card');
  const [desk, setDesk] = useState<DeskEntry[]>(loadDesk);
  const [openId, setOpenId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<{ balance: Balance; units: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'desk' | 'active' | 'history'>('desk');
  const [boardKey, setBoardKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef(false);
  const busyRef = useRef(false);
  const ownDispatch = useRef<{ customerId: string; at: number } | null>(null);
  const deskRef = useRef(desk);
  deskRef.current = desk;
  const seenEvent = useRef<string | null>(null);

  const opened = desk.find((entry) => entry.customer.id === openId) ?? null;

  useEffect(() => {
    localStorage.setItem(DESK_KEY, JSON.stringify(desk));
  }, [desk]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== DESK_KEY) return;
      const incoming = parseDesk(event.newValue);
      setDesk((prev) => mergeDesk(prev, incoming));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function stopCamera() {
    stopRef.current = true;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopCamera(), []);

  function upsert(entry: DeskEntry) {
    setDesk((prev) => {
      const base = mergeDesk(prev, loadDesk());
      const rest = base.filter((item) => item.customer.id !== entry.customer.id);
      return [entry, ...rest];
    });
    setOpenId(entry.customer.id);
  }

  async function resolveToken(raw: string, notice?: string) {
    setError(null);
    const data = await api<ResolveResult>('/cards/resolve', {
      method: 'POST',
      token,
      body: JSON.stringify({ token: raw.trim() }),
    });
    upsert({ ...data, raw: raw.trim() });
    void api('/service/visits', {
      method: 'POST',
      token,
      body: JSON.stringify({ customerId: data.customer.id }),
    })
      .then(() => setBoardKey((value) => value + 1))
      .catch(() => undefined);
    setMsg(notice ?? data.customer.name);
    return data;
  }

  useEffect(() => {
    if (!token || !cardFromLink) return;
    const raw =
      cardFromLink.startsWith('http') || cardFromLink.startsWith('LSC1:')
        ? cardFromLink
        : `${window.location.origin}/servicio?card=${cardFromLink}`;
    resolveToken(raw).catch((err) => setError(err instanceof Error ? err.message : 'Error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, cardFromLink]);

  useEffect(() => {
    const last = lastEvents[0];
    if (!last || last.name !== 'consumption.created') return;
    const mark = `${last.name}:${last.at}`;
    if (seenEvent.current === mark) return;
    seenEvent.current = mark;
    const customerId = (last.payload as { customerId?: string } | null)?.customerId;
    if (!customerId) return;
    const entry = deskRef.current.find((item) => item.customer.id === customerId);
    if (!entry || !token) return;
    setBoardKey((value) => value + 1);
    const mine = ownDispatch.current;
    if (mine && mine.customerId === customerId && Date.now() - mine.at < 4000) return;
    setPending(null);
    resolveToken(entry.raw, 'Otro camarero despachó en esta tarjeta. Los saldos se actualizaron.').catch(
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvents, token]);

  async function onResolve(e: FormEvent) {
    e.preventDefault();
    try {
      await resolveToken(code);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function openEntry(entry: DeskEntry) {
    setOpenId(entry.customer.id);
    setError(null);
    setMsg(null);
    try {
      await resolveToken(entry.raw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function startScan() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no abre la cámara. Escribe el código de la tarjeta.');
      return;
    }
    stopRef.current = false;
    setScanning(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (stopRef.current || !videoRef.current || !ctx) return;
        const current = videoRef.current;
        if (current.readyState >= current.HAVE_ENOUGH_DATA && current.videoWidth > 0) {
          canvas.width = current.videoWidth;
          canvas.height = current.videoHeight;
          ctx.drawImage(current, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          });
          if (found?.data) {
            stopCamera();
            void resolveToken(found.data).catch((err) =>
              setError(err instanceof Error ? err.message : 'Error'),
            );
            return;
          }
        }
        if (!stopRef.current) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      stopCamera();
      setError(err instanceof Error ? err.message : 'No se pudo abrir la cámara');
    }
  }

  function askDispatch(balance: Balance, units: number) {
    if (busyRef.current) return;
    if (!Number.isFinite(units) || units <= 0) {
      setError('Indica una cantidad mayor que cero.');
      return;
    }
    const left = Number(balance.quantityBase);
    if (units > left) {
      setError(`Solo quedan ${left} de ${balance.product.name}.`);
      return;
    }
    setError(null);
    setPending({ balance, units });
  }

  async function confirmDispatch() {
    if (!opened || !pending || busyRef.current) return;
    const { balance, units } = pending;
    const left = Number(balance.quantityBase);
    if (units > left) {
      setPending(null);
      setError(`Solo quedan ${left}. Otro despacho cambió el saldo.`);
      return;
    }
    busyRef.current = true;
    ownDispatch.current = { customerId: opened.customer.id, at: Date.now() };
    setBusy(true);
    setError(null);
    try {
      await api('/consumptions', {
        method: 'POST',
        token,
        idempotencyKey: newId(),
        body: JSON.stringify({
          customerId: opened.customer.id,
          warehouseId: balance.warehouse.id,
          lines: [{ productId: balance.product.id, quantityBase: units }],
          notes: 'Despacho en mesa',
        }),
      });
      setPending(null);
      await resolveToken(opened.raw, `Se entregaron ${units}. Quedan en la tarjeta.`);
    } catch (err) {
      setPending(null);
      setError(err instanceof Error ? err.message : 'Error');
      await resolveToken(opened.raw).catch(() => undefined);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={view}
        onChange={(_, value: 'desk' | 'active' | 'history' | null) => {
          if (value) setView(value);
        }}
      >
        <ToggleButton value="desk">Escritorio</ToggleButton>
        <ToggleButton value="active">Activos</ToggleButton>
        <ToggleButton value="history">Mi historial</ToggleButton>
      </ToggleButtonGroup>
      {view === 'active' ? <ActiveServices refreshKey={boardKey} /> : null}
      {view === 'history' ? <MyDispatches refreshKey={boardKey} /> : null}
      {view === 'desk' ? (
        <Typography color="text.secondary">
          Escanea las tarjetas. Quedan en el escritorio hasta que las quites. Al abrir una, se
          actualizan los saldos.
        </Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      {view === 'desk' ? (
      <>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Button variant="contained" size="large" onClick={() => void startScan()} disabled={scanning}>
            {scanning ? 'Apuntando al QR…' : 'Escanear QR'}
          </Button>
          <video
            ref={videoRef}
            style={{ width: '100%', borderRadius: 8, display: scanning ? 'block' : 'none' }}
            muted
            autoPlay
            playsInline
          />
          {scanning ? <Button onClick={stopCamera}>Cancelar cámara</Button> : null}
          <form onSubmit={onResolve}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Código de la tarjeta"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                fullWidth
              />
              <Button type="submit" variant="outlined" size="large" disabled={!code.trim()}>
                Agregar
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>

      {opened ? (
        <Stack spacing={2}>
          <Button onClick={() => setOpenId(null)}>Volver al escritorio</Button>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="overline" color="text.secondary">
              {opened.customer.code}
            </Typography>
            <Typography variant="h4">{opened.customer.name}</Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {opened.customer.phone ? (
                <Typography>Teléfono: {opened.customer.phone}</Typography>
              ) : null}
              {opened.customer.email ? (
                <Typography>Correo: {opened.customer.email}</Typography>
              ) : null}
              <Typography color="text.secondary">Estado: {opened.customer.status}</Typography>
            </Stack>
          </Paper>
          {opened.allocationBalances.length === 0 ? (
            <Alert severity="info">{opened.customer.name} no tiene unidades pendientes.</Alert>
          ) : (
            opened.allocationBalances.map((balance) => (
              <Paper
                key={balance.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="h6">{balance.product.name}</Typography>
                <Typography variant="h2" sx={{ my: 1 }}>
                  {Number(balance.quantityBase)}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  restantes de {Number(balance.quantityAssigned)} · ya se sirvieron{' '}
                  {Number(balance.quantityConsumed)}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" size="large" disabled={busy} onClick={() => askDispatch(balance, 1)}>
                    1
                  </Button>
                  <Button variant="contained" size="large" disabled={busy} onClick={() => askDispatch(balance, 2)}>
                    2
                  </Button>
                  <TextField
                    label="Otra cantidad"
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    sx={{ width: 140 }}
                    inputProps={{ min: 1, step: 1 }}
                  />
                  <Button
                    variant="outlined"
                    size="large"
                    disabled={busy}
                    onClick={() => askDispatch(balance, Number(qty))}
                  >
                    Despachar
                  </Button>
                </Stack>
              </Paper>
            ))
          )}
          <Button
            color="inherit"
            onClick={() => {
              setDesk((prev) => prev.filter((item) => item.customer.id !== opened.customer.id));
              setOpenId(null);
            }}
          >
            Quitar del escritorio
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography variant="h6">Escritorio ({desk.length})</Typography>
          {desk.length === 0 ? (
            <Typography color="text.secondary">Todavía no hay tarjetas escaneadas.</Typography>
          ) : (
            desk.map((entry) => (
              <Paper
                key={entry.customer.id}
                elevation={0}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack>
                    <Typography variant="overline">{entry.customer.code}</Typography>
                    <Typography variant="h6">{entry.customer.name}</Typography>
                    <Typography color="text.secondary">
                      {entry.customer.phone || 'Sin teléfono'} · {remaining(entry)} u. pendientes
                    </Typography>
                  </Stack>
                  <Button variant="contained" onClick={() => void openEntry(entry)}>
                    Abrir
                  </Button>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      )}
      </>
      ) : null}

      <Dialog open={Boolean(pending)} onClose={() => (busy ? undefined : setPending(null))}>
        <DialogTitle>Confirmar despacho</DialogTitle>
        <DialogContent>
          <Typography>
            Entregar {pending?.units} de {pending?.balance.product.name} a {opened?.customer.name} (
            {opened?.customer.code}).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void confirmDispatch()} disabled={busy}>
            {busy ? 'Despachando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
