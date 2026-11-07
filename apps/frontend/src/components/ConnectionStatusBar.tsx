import { Chip, Stack, Tooltip, Typography } from '@mui/material';
import { useBranch } from '../context/BranchContext';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useRealtime } from '../hooks/useRealtime';

export function ConnectionStatusBar() {
  const { online, pendingCount, syncing, lastSyncMessage, replay } =
    useOfflineSync();
  const { connected, lastEvents } = useRealtime(true);
  const { branches, branchId, setBranchId, currentBranch } = useBranch();
  const last = lastEvents[0];

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      sx={{ mb: 2 }}
    >
      <select
        aria-label="Sucursal"
        value={branchId ?? ''}
        onChange={(e) => setBranchId(e.target.value || null)}
        style={{
          minHeight: 36,
          borderRadius: 8,
          border: '1px solid #c4b8a4',
          background: '#fffdf8',
          padding: '6px 10px',
          fontFamily: 'inherit',
        }}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} — {b.name}
          </option>
        ))}
      </select>

      <Chip
        size="small"
        label={online ? 'Online' : 'Offline'}
        color={online ? 'success' : 'warning'}
        variant="outlined"
      />
      <Chip
        size="small"
        label={connected ? 'Realtime' : 'Sin socket'}
        color={connected ? 'success' : 'default'}
        variant="outlined"
      />
      {pendingCount > 0 ? (
        <Tooltip title={lastSyncMessage ?? 'Cola offline'}>
          <Chip
            size="small"
            color="secondary"
            label={
              syncing
                ? `Sincronizando (${pendingCount})…`
                : `Pendientes: ${pendingCount}`
            }
            onClick={() => void replay()}
          />
        </Tooltip>
      ) : null}
      {currentBranch ? (
        <Typography variant="caption" color="text.secondary">
          {currentBranch.warehouses.length} almacenes
        </Typography>
      ) : null}
      {last ? (
        <Typography variant="caption" color="text.secondary" noWrap>
          Último evento: {last.name}
        </Typography>
      ) : null}
    </Stack>
  );
}
