import { useState } from 'react';
import {
  Alert,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export function PosTerminal() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  function onScan() {
    if (!token.trim()) {
      setMessage('Ingresa o escanea el token de la tarjeta.');
      return;
    }
    setMessage(
      `Token recibido (stub). En MVP se resolverá vía POST /api/v1/cards/resolve.`,
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="h4">Terminal POS / escaneo</Typography>
        <Typography color="text.secondary">
          Los empleados escanean la tarjeta del cliente para asignar o registrar
          consumo. El cliente puede consultar su historial en el portal.
        </Typography>
        <TextField
          label="Token de tarjeta (QR / código de barras)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          fullWidth
          autoFocus
        />
        <Button variant="contained" onClick={onScan} sx={{ alignSelf: 'flex-start' }}>
          Resolver tarjeta
        </Button>
        {message ? <Alert severity="success">{message}</Alert> : null}
      </Stack>
    </Paper>
  );
}
