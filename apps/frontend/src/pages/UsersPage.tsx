import { FormEvent, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
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

type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
};
type Perm = { id: string; code: string; name: string; module: string };
type RolePerm = { role: string; permission: Perm };

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'];
const ROLE_LABEL: Record<string, string> = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE (camarero)',
  CUSTOMER: 'CUSTOMER',
};

export function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [catalog, setCatalog] = useState<Perm[]>([]);
  const [matrix, setMatrix] = useState<RolePerm[]>([]);
  const [myPerms, setMyPerms] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('Empleado123!');
  const [role, setRole] = useState('EMPLOYEE');
  const [editRole, setEditRole] = useState('MANAGER');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    const [u, c, m, me] = await Promise.all([
      api<User[]>('/users', { token }),
      api<Perm[]>('/permissions/catalog', { token }),
      api<RolePerm[]>('/permissions/roles', { token }),
      api<string[]>('/permissions/me', { token }),
    ]);
    setUsers(u);
    setCatalog(c);
    setMatrix(m);
    setMyPerms(me);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function roleHas(r: string, code: string) {
    return matrix.some((x) => x.role === r && x.permission.code === code);
  }

  async function toggle(r: string, code: string, enabled: boolean) {
    setError(null);
    try {
      await api('/permissions/roles', {
        method: 'POST',
        token,
        body: JSON.stringify({ role: r, permissionCode: code, enabled }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/users', {
        method: 'POST',
        token,
        body: JSON.stringify({ email, fullName, password, role }),
      });
      setMsg(`Usuario ${email} creado`);
      setEmail('');
      setFullName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function changeRole(userId: string, newRole: string) {
    await api(`/users/${userId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role: newRole }),
    });
    await reload();
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Usuarios y permisos</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {msg ? <Alert severity="success">{msg}</Alert> : null}
      <Alert severity="info">
        Tus permisos efectivos: {myPerms.join(', ') || '(ninguno)'}
      </Alert>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Nuevo usuario
        </Typography>
        <form onSubmit={onCreate}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField label="Nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <TextField select label="Rol" value={role} onChange={(e) => setRole(e.target.value)} sx={{ minWidth: 140 }}>
                {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained">
              Crear
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Usuarios del tenant
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Cambiar rol</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.status}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    sx={{ minWidth: 120 }}
                  >
                {ROLES.map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABEL[r] ?? r}
                </MenuItem>
              ))}
                  </TextField>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Matriz de permisos por rol
        </Typography>
        <TextField
          select
          label="Editar rol"
          value={editRole}
          onChange={(e) => setEditRole(e.target.value)}
          sx={{ mb: 2, minWidth: 160 }}
        >
          {ROLES.filter((r) => r !== 'OWNER').map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABEL[r] ?? r}
            </MenuItem>
          ))}
        </TextField>
        <Stack>
          {catalog.map((p) => (
            <FormControlLabel
              key={p.code}
              control={
                <Checkbox
                  checked={roleHas(editRole, p.code)}
                  onChange={(e) => toggle(editRole, p.code, e.target.checked)}
                />
              }
              label={`${p.module} · ${p.code} — ${p.name}`}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
