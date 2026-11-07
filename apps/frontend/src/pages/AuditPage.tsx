import { useEffect, useState } from 'react';
import {
  Alert,
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

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  context: string | null;
  createdAt: string;
  actor?: { fullName: string; email: string; role: string } | null;
};

export function AuditPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entityType, setEntityType] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const q = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
    api<AuditRow[]>(`/audit-logs${q}`, { token })
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [token, entityType]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Auditoría</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        label="Filtrar entityType"
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        placeholder="sales, orders, returns…"
        sx={{ maxWidth: 280 }}
      />
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cuándo</TableCell>
              <TableCell>Quién</TableCell>
              <TableCell>Acción</TableCell>
              <TableCell>Entidad</TableCell>
              <TableCell>Contexto</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  {r.actor
                    ? `${r.actor.fullName} (${r.actor.role})`
                    : '—'}
                </TableCell>
                <TableCell>
                  <code style={{ fontSize: 12 }}>{r.action}</code>
                </TableCell>
                <TableCell>
                  {r.entityType}
                  {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}
                </TableCell>
                <TableCell>{r.context}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
