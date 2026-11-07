import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
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

type Customer = {
  id: string;
  code: string;
  name: string;
  billingModes: string[];
  status: string;
  cards: { id: string; status: string; label: string | null }[];
};

export function CustomersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    setRows(await api<Customer[]>('/customers', { token }));
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/customers', {
        method: 'POST',
        token,
        body: JSON.stringify({
          code,
          name,
          billingModes: ['CHARGE_ON_ALLOCATION', 'CHARGE_ON_CONSUMPTION'],
        }),
      });
      setCode('');
      setName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function issueCard(customerId: string) {
    setError(null);
    setIssuedToken(null);
    try {
      const card = await api<{ token: string; id: string }>('/cards', {
        method: 'POST',
        token,
        body: JSON.stringify({ customerId, label: 'POS' }),
      });
      setIssuedToken(card.token);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function revokeCard(cardId: string) {
    await api(`/cards/${cardId}/revoke`, { method: 'POST', token });
    await reload();
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Nuevo cliente
        </Typography>
        <form onSubmit={onCreate}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ flex: 1 }}
            />
            <Button type="submit" variant="contained">
              Crear
            </Button>
          </Stack>
        </form>
      </Paper>

      {issuedToken ? (
        <Alert severity="warning">
          Token de tarjeta (cópialo ahora; no se vuelve a mostrar):{' '}
          <code>{issuedToken}</code>
        </Alert>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Clientes y tarjetas
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Cobro</TableCell>
              <TableCell>Tarjetas</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.code}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  {(c.billingModes ?? []).map((m) => (
                    <Chip key={m} size="small" label={m} sx={{ mr: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  {c.cards.map((card) => (
                    <Chip
                      key={card.id}
                      size="small"
                      color={card.status === 'ACTIVE' ? 'success' : 'default'}
                      label={`${card.label ?? 'QR'} · ${card.status}`}
                      onDelete={
                        card.status === 'ACTIVE'
                          ? () => revokeCard(card.id)
                          : undefined
                      }
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => issueCard(c.id)}>
                    Emitir QR
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
