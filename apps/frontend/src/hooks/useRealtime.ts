import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/api\/v1\/?$/, '')
    : 'http://localhost:3000');

export type RealtimeEvent = {
  name: string;
  payload: unknown;
  at: string;
};

export function useRealtime(enabled = true) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastEvents, setLastEvents] = useState<RealtimeEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(`${SOCKET_URL}/realtime`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const push = (name: string, payload: unknown) => {
      const at =
        typeof payload === 'object' &&
        payload &&
        'at' in payload &&
        typeof (payload as { at: unknown }).at === 'string'
          ? (payload as { at: string }).at
          : new Date().toISOString();
      setLastEvents((prev) => [{ name, payload, at }, ...prev].slice(0, 30));
    };

    const events = [
      'consumption.created',
      'sale.created',
      'sale.payment',
      'stock.low',
      'inventory.changed',
      'transfer.completed',
      'realtime.ready',
    ];
    for (const ev of events) {
      socket.on(ev, (payload: unknown) => push(ev, payload));
    }

    return () => {
      for (const ev of events) socket.off(ev);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token, enabled]);

  return { connected, lastEvents, socket: socketRef };
}
