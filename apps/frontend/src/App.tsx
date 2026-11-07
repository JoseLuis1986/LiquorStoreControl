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
import { AdminHome } from './pages/AdminHome';
import { CustomersPage } from './pages/CustomersPage';
import { HistoryPage } from './pages/HistoryPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { PosTerminal } from './pages/PosTerminal';
import { ProductsPage } from './pages/ProductsPage';

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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
            sx={{ mb: 4 }}
          >
            <Typography variant="h3" component="h1" color="primary">
              LiquorControl
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button component={RouterLink} to="/" size="small">
                Inicio
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
      <Shell />
    </AuthProvider>
  );
}
