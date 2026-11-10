import { useEffect, useState } from 'react';
import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

type ActiveService = {
  customer: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    cardLabel: string | null;
  };
  pending: { productName: string; quantityBase: string; quantityConsumed: string }[];
  events: {
    kind: 'SCAN' | 'DISPATCH';
    at: string;
    userId: string;
    userName: string;
    lines: { productName: string; quantityBase: string }[];
  }[];
};

type DispatchRow = {
  id: string;
  createdAt: string;
  customer: { code: string; name: string };
  lines: { quantityBase: string; product: { name: string } }[];
};

function when(iso: string) {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function ActiveServices({ refreshKey }: { refreshKey: number }) {
  const { token, session } = useAuth();
  const [rows, setRows] = useState<ActiveService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = session?.user.id;

  useEffect(() => {
    if (!token) return;
    api<ActiveService[]>('/service/active', { token })
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, [token, refreshKey]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return <Typography>Cargando servicios…</Typography>;
  if (!rows.length) {
    return <Typography color="text.secondary">No hay servicios con saldo ni atención reciente.</Typography>;
  }

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        Cada tarjeta agrupa a todos los camareros que la escanearon o despacharon en los últimos 7
        días, incluido tu usuario.
      </Typography>
      {rows.map((row) => {
        const waiters = [...new Set(row.events.map((event) => event.userName))];
        return (
          <Paper
            key={row.customer.id}
            elevation={0}
            sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="overline">{row.customer.code}</Typography>
            <Typography variant="h6">{row.customer.name}</Typography>
            <Typography color="text.secondary">
              {row.customer.cardLabel ? `Tarjeta ${row.customer.cardLabel}` : 'Tarjeta activa'}
              {row.customer.phone ? ` · ${row.customer.phone}` : ''}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {waiters.map((name) => (
                <Chip key={name} size="small" label={name} />
              ))}
            </Stack>
            {row.pending.length ? (
              <Stack spacing={0.5} sx={{ mb: 1 }}>
                {row.pending.map((item) => (
                  <Typography key={item.productName}>
                    {item.productName}: {Number(item.quantityBase)} por consumir · ya servidas{' '}
                    {Number(item.quantityConsumed)}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ mb: 1 }}>Sin saldo pendiente.</Typography>
            )}
            <Stack spacing={0.75}>
              {row.events.map((event, index) => (
                <Typography key={`${event.at}-${event.userId}-${index}`} variant="body2">
                  {when(event.at)} · {event.userId === me ? 'Tú' : event.userName}{' '}
                  {event.kind === 'SCAN'
                    ? 'escaneó la tarjeta'
                    : `despachó ${event.lines
                        .map((line) => `${Number(line.quantityBase)} ${line.productName}`)
                        .join(', ')}`}
                </Typography>
              ))}
              {!row.events.length ? (
                <Typography variant="body2" color="text.secondary">
                  Sin escaneos ni despachos en los últimos 7 días.
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

export function MyDispatches({ refreshKey }: { refreshKey: number }) {
  const { token } = useAuth();
  const [rows, setRows] = useState<DispatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<DispatchRow[]>('/service/my-dispatches', { token })
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, [token, refreshKey]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rows) return <Typography>Cargando historial…</Typography>;
  if (!rows.length) {
    return <Typography color="text.secondary">Todavía no has despachado.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Paper key={row.id} elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="overline">{when(row.createdAt)}</Typography>
          <Typography variant="h6">
            {row.customer.name} ({row.customer.code})
          </Typography>
          {row.lines.map((line, index) => (
            <Typography key={`${row.id}-${index}`}>
              {Number(line.quantityBase)} × {line.product.name}
            </Typography>
          ))}
        </Paper>
      ))}
    </Stack>
  );
}
