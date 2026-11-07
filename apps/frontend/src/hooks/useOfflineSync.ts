import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  listOfflineOps,
  OfflineQueuedOp,
  removeOfflineOp,
  updateOfflineOp,
} from '../offline/queue';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineSync() {
  const { token } = useAuth();
  const online = useOnlineStatus();
  const [pending, setPending] = useState<OfflineQueuedOp[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPending(await listOfflineOps());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const replay = useCallback(async () => {
    if (!token || !online || syncing) return;
    setSyncing(true);
    try {
      const ops = await listOfflineOps();
      let ok = 0;
      for (const op of ops) {
        try {
          await api(op.path, {
            method: op.method,
            token,
            idempotencyKey: op.idempotencyKey,
            body: JSON.stringify(op.body),
          });
          await removeOfflineOp(op.id);
          ok += 1;
        } catch (err) {
          await updateOfflineOp({
            ...op,
            attempts: op.attempts + 1,
            lastError: err instanceof Error ? err.message : 'Error',
          });
        }
      }
      await refresh();
      setLastSyncMessage(
        ok > 0
          ? `Sincronizadas ${ok} operaciones pendientes`
          : ops.length
            ? 'No se pudo sincronizar alguna operación'
            : 'Cola vacía',
      );
    } finally {
      setSyncing(false);
    }
  }, [token, online, syncing, refresh]);

  useEffect(() => {
    if (online && token) void replay();
  }, [online, token, replay]);

  return {
    online,
    pending,
    pendingCount: pending.length,
    syncing,
    lastSyncMessage,
    refresh,
    replay,
  };
}
