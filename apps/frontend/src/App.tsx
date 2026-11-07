import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { Link as RouterLink, Route, Routes } from 'react-router-dom';
import { AdminHome } from './pages/AdminHome';
import { PosTerminal } from './pages/PosTerminal';

export function App() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 600px at 10% -10%, #d8e2c8 0%, transparent 55%), radial-gradient(900px 500px at 100% 0%, #e7d3b5 0%, transparent 50%), linear-gradient(180deg, #f7f3ea 0%, #ebe4d6 100%)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/" variant="contained">
              Admin
            </Button>
            <Button component={RouterLink} to="/pos" variant="outlined">
              Terminal POS
            </Button>
          </Stack>
        </Stack>
        <Routes>
          <Route path="/" element={<AdminHome />} />
          <Route path="/pos" element={<PosTerminal />} />
        </Routes>
      </Container>
    </Box>
  );
}
