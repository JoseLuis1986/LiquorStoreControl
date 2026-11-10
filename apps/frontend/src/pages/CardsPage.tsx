import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

type CardRow = { id: string; status: string; label: string | null };
type Customer = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  cards: CardRow[];
};

export function CardsPage() {
  const { token, session } = useAuth();
  const role = session?.user.role;
  const canManage = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER';
  const canPrint = role === 'OWNER' || role === 'ADMIN';
  const [rows, setRows] = useState<Customer[]>([]);
  const [code, setCode] = useState('MESA-02');
  const [name, setName] = useState('Mesa 02');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');

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
    setMsg(null);
    try {
      const customer = await api<Customer>('/customers', {
        method: 'POST',
        token,
        body: JSON.stringify({ code, name, billingModes: [] }),
      });
      const card = await api<{ id: string }>('/cards', {
        method: 'POST',
        token,
        body: JSON.stringify({ customerId: customer.id, label: name }),
      });
      setMsg(`Tarjeta lista para ${name}. Descarga el SVG e imprímelo en PVC.`);
      await reload();
      if (canPrint) await showArtwork(card.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function issue(customer: Customer) {
    setError(null);
    try {
      const card = await api<{ id: string }>('/cards', {
        method: 'POST',
        token,
        body: JSON.stringify({ customerId: customer.id, label: customer.name }),
      });
      setMsg(`Tarjeta emitida para ${customer.name}.`);
      await reload();
      if (canPrint) await showArtwork(card.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone ?? '');
    setEditEmail(customer.email ?? '');
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await api('/customers/' + editing.id, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          email: editEmail,
        }),
      });
      setMsg(`Datos de ${editing.code} actualizados. El identificador no cambia.`);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function showArtwork(cardId: string) {
    const art = await api<{ svg: string; filename: string }>('/cards/' + cardId + '/artwork', {
      token,
    });
    setPreview(art.svg);
    return art;
  }

  function download(svg: string, filename: string) {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printSvg(svg: string) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      `<!doctype html><title>Tarjeta PVC</title><style>@page{size:85.6mm 53.98mm;margin:0}body{margin:0}svg{width:85.6mm;height:53.98mm}</style>${svg}`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Tarjetas PVC</Typography>
      <Typography color="text.secondary">
        Cada tarjeta tiene un identificador fijo (CLI-01 … CLI-50) con el que se asocian
        las compras. El nombre, el teléfono y el correo se pueden cambiar sin perder ese
        vínculo. Vuelve a imprimir la tarjeta si quieres ver el nombre nuevo en el plástico.
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}

      {canManage ? (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Nueva mesa o cliente
          </Typography>
          <form onSubmit={onCreate}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
              <TextField
                label="Nombre en la tarjeta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{ flex: 1 }}
              />
              <Button type="submit" variant="contained">
                Crear e emitir
              </Button>
            </Stack>
          </form>
        </Paper>
      ) : null}

      {preview ? (
        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Vista de impresión
          </Typography>
          <div dangerouslySetInnerHTML={{ __html: preview }} />
        </Paper>
      ) : null}

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Identificador</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Tarjeta</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => {
              const active = c.cards.find((card) => card.status === 'ACTIVE');
              return (
                <TableRow key={c.id}>
                  <TableCell>{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{active ? 'Activa' : 'Sin tarjeta'}</TableCell>
                  <TableCell align="right">
                    {canManage ? (
                      <Button size="small" onClick={() => openEdit(c)}>
                        Editar
                      </Button>
                    ) : null}
                    {active && canPrint ? (
                      <Button
                        size="small"
                        onClick={() =>
                          showArtwork(active.id)
                            .then((art) => {
                              download(art.svg, art.filename);
                              printSvg(art.svg);
                            })
                            .catch((err) => setError(err.message))
                        }
                      >
                        Descargar e imprimir
                      </Button>
                    ) : null}
                    {!active && canManage ? (
                      <Button size="small" onClick={() => issue(c)}>
                        Emitir
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <form onSubmit={saveEdit}>
          <DialogTitle>Editar {editing?.code}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label="Identificador" value={editing?.code ?? ''} disabled />
              <TextField
                label="Nombre"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
              />
              <TextField
                label="Teléfono"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
              <TextField
                label="Correo"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancelar</Button>
            <Button type="submit" variant="contained">
              Guardar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
