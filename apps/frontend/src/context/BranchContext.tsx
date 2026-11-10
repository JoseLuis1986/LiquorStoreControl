import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export type Branch = {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  active: boolean;
  warehouses: { id: string; code: string; name: string; active: boolean }[];
};

type BranchContextValue = {
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  currentBranch: Branch | null;
  warehouseIds: string[];
  refresh: () => Promise<void>;
};

const STORAGE_KEY = 'liquorcontrol.branchId';
const BranchCtx = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { token, session } = useAuth();
  const waiter = session?.user.role === 'EMPLOYEE';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );

  const refresh = useCallback(async () => {
    if (!token || waiter) {
      setBranches([]);
      return;
    }
    const list = await api<Branch[]>('/branches', { token });
    setBranches(list);
    if (list.length && (!branchId || !list.some((b) => b.id === branchId))) {
      const next = list[0].id;
      setBranchIdState(next);
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, [token, branchId, waiter]);

  useEffect(() => {
    void refresh().catch(() => setBranches([]));
  }, [refresh]);

  const setBranchId = useCallback((id: string | null) => {
    setBranchIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const currentBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branches, branchId],
  );

  const warehouseIds = useMemo(
    () => currentBranch?.warehouses.map((w) => w.id) ?? [],
    [currentBranch],
  );

  const value = useMemo(
    () => ({
      branches,
      branchId,
      setBranchId,
      currentBranch,
      warehouseIds,
      refresh,
    }),
    [branches, branchId, setBranchId, currentBranch, warehouseIds, refresh],
  );

  return <BranchCtx.Provider value={value}>{children}</BranchCtx.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchCtx);
  if (!ctx) throw new Error('useBranch fuera de BranchProvider');
  return ctx;
}
