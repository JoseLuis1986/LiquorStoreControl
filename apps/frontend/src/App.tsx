import {
  Box,
  Button,
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
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { AdminHome } from './pages/AdminHome';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AuditPage } from './pages/AuditPage';
import { CashSalesPage } from './pages/CashSalesPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
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

function Shell() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, #d8e2c8 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e7d3b5 0%, transparent 50%), linear-gradient(180deg, #f7f3ea 0%, #ebe4d6 100%)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {!isLogin ? (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <Typography variant="h3" component="h1" color="primary">
                LiquorControl
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button component={RouterLink} to="/" size="small">
                  Inicio
                </Button>
                <Button component={RouterLink} to="/dashboard" size="small" variant="contained">
                  Dashboard
                </Button>
                <Button component={RouterLink} to="/analytics" size="small">
                  Analítica
                </Button>
                <Button component={RouterLink} to="/reports" size="small">
                  Reportes
                </Button>
                <Button component={RouterLink} to="/audit" size="small">
                  Auditoría
                </Button>
                <Button component={RouterLink} to="/users" size="small">
                  Usuarios
                </Button>
                <Button component={RouterLink} to="/products" size="small">
                  Productos
                </Button>
                <Button component={RouterLink} to="/customers" size="small">
                  Clientes
                </Button>
                <Button component={RouterLink} to="/inventory" size="small">
                  Inventario
                </Button>
                <Button component={RouterLink} to="/transfers" size="small">
                  Transferencias
                </Button>
                <Button component={RouterLink} to="/purchases" size="small">
                  Compras
                </Button>
                <Button component={RouterLink} to="/cash" size="small">
                  Caja/Ventas
                </Button>
                <Button component={RouterLink} to="/returns" size="small">
                  Devoluciones
                </Button>
                <Button component={RouterLink} to="/pos" size="small" variant="contained">
                  Terminal POS
                </Button>
                <Button component={RouterLink} to="/history" size="small">
                  Historial
                </Button>
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
              <RequireAuth>
                <AdminHome />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAuth>
                <AnalyticsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/audit"
            element={
              <RequireAuth>
                <AuditPage />
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <UsersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/products"
            element={
              <RequireAuth>
                <ProductsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/customers"
            element={
              <RequireAuth>
                <CustomersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireAuth>
                <InventoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/transfers"
            element={
              <RequireAuth>
                <TransfersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/purchases"
            element={
              <RequireAuth>
                <PurchasesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/cash"
            element={
              <RequireAuth>
                <CashSalesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/returns"
            element={
              <RequireAuth>
                <ReturnsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/pos"
            element={
              <RequireAuth>
                <PosTerminal />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BranchProvider>
        <Shell />
      </BranchProvider>
    </AuthProvider>
  );
}
