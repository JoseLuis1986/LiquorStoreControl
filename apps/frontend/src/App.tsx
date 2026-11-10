import {
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { ExchangeProvider, useExchange } from './context/ExchangeContext';
import { formatRate } from './money';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { AdminHome } from './pages/AdminHome';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { CardsPage } from './pages/CardsPage';
import { CashSalesPage } from './pages/CashSalesPage';
import { ServicePage } from './pages/ServicePage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExchangePage } from './pages/ExchangePage';
import { HistoryPage } from './pages/HistoryPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { PosTerminal } from './pages/PosTerminal';
import { ProductsPage } from './pages/ProductsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { TransfersPage } from './pages/TransfersPage';
import { UsersPage } from './pages/UsersPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function RequireOffice({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (session.user.role === 'EMPLOYEE') {
    return <Navigate to="/servicio" replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  const waiter = session?.user.role === 'EMPLOYEE';
  const { rate } = useExchange();
  const rateLabel = rate ? formatRate(rate.usdToVes) : '';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, #d8e2c8 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e7d3b5 0%, transparent 50%), linear-gradient(180deg, #f7f3ea 0%, #ebe4d6 100%)',
      }}
    >
      <Container maxWidth={waiter ? 'sm' : 'lg'} sx={{ py: waiter ? 2 : 4 }}>
        {!isLogin && waiter ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Stack>
              <Typography variant="h5" component="h1" color="primary">
                Servicio en mesa
              </Typography>
              {rateLabel ? (
                <Typography variant="caption" color="text.secondary">
                  {rateLabel} · {rate?.mode === 'MANUAL' ? 'manual' : 'BCV'}
                </Typography>
              ) : null}
            </Stack>
            <Button size="small" color="inherit" onClick={logout}>
              Salir
            </Button>
          </Stack>
        ) : !isLogin ? (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h3" component="h1" color="primary">
                  LiquorControl
                </Typography>
                {rateLabel ? <Chip size="small" label={`${rateLabel} · ${rate?.mode === 'MANUAL' ? 'manual' : 'BCV'}`} /> : null}
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(
                  [
                    ['/', 'Inicio'],
                    ['/dashboard', 'Dashboard'],
                    ['/analytics', 'Analítica'],
                    ['/reports', 'Reportes'],
                    ['/audit', 'Auditoría'],
                    ['/users', 'Usuarios'],
                    ['/products', 'Productos'],
                    ['/customers', 'Clientes'],
                    ['/tarjetas', 'Tarjetas'],
                    ['/inventory', 'Inventario'],
                    ['/transfers', 'Transferencias'],
                    ['/purchases', 'Compras'],
                    ['/cash', 'Caja/Ventas'],
                    ['/returns', 'Devoluciones'],
                    ['/pos', 'Terminal POS'],
                    ['/servicio', 'Servicio'],
                    ['/tasa', 'Tasa'],
                    ['/history', 'Historial'],
                  ] as const
                ).map(([path, label]) => (
                  <Button
                    key={path}
                    component={RouterLink}
                    to={path}
                    size="small"
                    variant={location.pathname === path ? 'contained' : 'text'}
                  >
                    {label}
                  </Button>
                ))}
                {session ? (
                  <Button size="small" color="inherit" onClick={logout}>
                    Salir
                  </Button>
                ) : null}
              </Stack>
            </Stack>
            {session ? <ConnectionStatusBar /> : null}
          </>
        ) : (
          <Typography
            variant="h3"
            component="h1"
            color="primary"
            sx={{ mb: 4, textAlign: 'center' }}
          >
            LiquorControl
          </Typography>
        )}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireOffice>
                <AdminHome />
              </RequireOffice>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireOffice>
                <DashboardPage />
              </RequireOffice>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireOffice>
                <AnalyticsPage />
              </RequireOffice>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireOffice>
                <ReportsPage />
              </RequireOffice>
            }
          />
          <Route
            path="/audit"
            element={
              <RequireOffice>
                <AuditPage />
              </RequireOffice>
            }
          />
          <Route
            path="/users"
            element={
              <RequireOffice>
                <UsersPage />
              </RequireOffice>
            }
          />
          <Route
            path="/products"
            element={
              <RequireOffice>
                <ProductsPage />
              </RequireOffice>
            }
          />
          <Route
            path="/customers"
            element={
              <RequireOffice>
                <CustomersPage />
              </RequireOffice>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireOffice>
                <InventoryPage />
              </RequireOffice>
            }
          />
          <Route
            path="/transfers"
            element={
              <RequireOffice>
                <TransfersPage />
              </RequireOffice>
            }
          />
          <Route
            path="/purchases"
            element={
              <RequireOffice>
                <PurchasesPage />
              </RequireOffice>
            }
          />
          <Route
            path="/cash"
            element={
              <RequireOffice>
                <CashSalesPage />
              </RequireOffice>
            }
          />
          <Route
            path="/returns"
            element={
              <RequireOffice>
                <ReturnsPage />
              </RequireOffice>
            }
          />
          <Route
            path="/pos"
            element={
              <RequireOffice>
                <PosTerminal />
              </RequireOffice>
            }
          />
          <Route
            path="/servicio"
            element={
              <RequireAuth>
                <ServicePage />
              </RequireAuth>
            }
          />
          <Route
            path="/tarjetas"
            element={
              <RequireOffice>
                <CardsPage />
              </RequireOffice>
            }
          />
          <Route
            path="/tasa"
            element={
              <RequireOffice>
                <ExchangePage />
              </RequireOffice>
            }
          />
          <Route
            path="/history"
            element={
              <RequireOffice>
                <HistoryPage />
              </RequireOffice>
            }
          />
          <Route path="*" element={<Navigate to={waiter ? '/servicio' : '/'} replace />} />
        </Routes>
      </Container>
    </Box>
  );
}

export function App() {
  return (
      <AuthProvider>
        <ExchangeProvider>
          <BranchProvider>
            <Shell />
          </BranchProvider>
        </ExchangeProvider>
      </AuthProvider>
  );
}
