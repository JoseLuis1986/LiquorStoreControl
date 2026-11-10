import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatMoney } from '../money';

export type ExchangeRate = {
  mode: 'MANUAL' | 'AUTOMATIC';
  usdToVes: number;
  source: string;
  fetchedAt: string | null;
  updatedAt: string;
};

type ExchangeContextValue = {
  rate: ExchangeRate | null;
  reload: () => Promise<void>;
  money: (amount: number | string) => string;
};

const ExchangeContext = createContext<ExchangeContextValue | null>(null);

export function ExchangeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [rate, setRate] = useState<ExchangeRate | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setRate(null);
      return;
    }
    const data = await api<ExchangeRate>('/exchange-rate', { token });
    setRate(data);
  }, [token]);

  useEffect(() => {
    reload().catch(() => setRate(null));
  }, [reload]);

  const value = useMemo(
    () => ({
      rate,
      reload,
      money: (amount: number | string) => formatMoney(amount, rate?.usdToVes ?? 0),
    }),
    [rate, reload],
  );

  return <ExchangeContext.Provider value={value}>{children}</ExchangeContext.Provider>;
}

export function useExchange() {
  const ctx = useContext(ExchangeContext);
  if (!ctx) throw new Error('useExchange fuera de ExchangeProvider');
  return ctx;
}
