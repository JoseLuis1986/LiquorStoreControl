import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useExchange } from '../context/ExchangeContext';
import { formatRate } from '../money';

export function ExchangePage() {
  const { token } = useAuth();
  const { rate, reload, money } = useExchange();
  const [mode, setMode] = useState<'MANUAL' | 'AUTOMATIC'>(rate?.mode ?? 'AUTOMATIC');
  const [usdToVes, setUsdToVes] = useState(rate?.usdToVes ? String(rate.usdToVes) : '');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!rate) return;
    setMode(rate.mode);
    if (rate.usdToVes > 0) setUsdToVes(String(rate.usdToVes));
  }, [rate]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      await api('/exchange-rate', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          mode,
          usdToVes: mode === 'MANUAL' ? Number(usdToVes) : undefined,
        }),
      });
      await reload();
      setMsg(mode === 'AUTOMATIC' ? 'Tasa tomada del BCV' : 'Tasa manual guardada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      await api('/exchange-rate/refresh', { method: 'POST', token });
      await reload();
      setMode('AUTOMATIC');
      setMsg('Tasa actualizada desde el BCV');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  const shown = rate?.usdToVes ?? 0;
  const when = rate?.fetchedAt
    ? new Date(rate.fetchedAt).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'aún no consultada';

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Tasa dólar / bolívar</Typography>
      <Typography color="text.secondary">
        Los precios del catálogo están en dólares. Con esta tasa el sistema muestra el equivalente
        en bolívares en caja, comprobantes y reportes.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5">{formatRate(shown)}</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {rate?.mode === 'MANUAL' ? 'Manual' : 'Automática'} · {rate?.source ?? 'BCV'} · {when}
        </Typography>
        <Typography sx={{ mb: 2 }}>Ejemplo: 10 dólares son {money(10)}</Typography>
        <form onSubmit={save}>
          <Stack spacing={2}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_, value: 'MANUAL' | 'AUTOMATIC' | null) => {
                if (value) setMode(value);
              }}
            >
              <ToggleButton value="AUTOMATIC">Automático (BCV)</ToggleButton>
              <ToggleButton value="MANUAL">Manual</ToggleButton>
            </ToggleButtonGroup>
            {mode === 'MANUAL' ? (
              <TextField
                label="Bolívares por 1 dólar"
                type="number"
                value={usdToVes}
                onChange={(e) => setUsdToVes(e.target.value)}
                required
                inputProps={{ min: 0.0001, step: '0.0001' }}
                sx={{ maxWidth: 280 }}
              />
            ) : (
              <Typography color="text.secondary">
                Se lee la tasa oficial del Banco Central de Venezuela y se refresca cada hora.
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={busy}>
                Guardar
              </Button>
              <Button onClick={() => void refresh()} disabled={busy}>
                Actualizar desde el BCV
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
