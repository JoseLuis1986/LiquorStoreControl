import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1b4332' },
    secondary: { main: '#bc6c25' },
    background: { default: '#f3efe6', paper: '#fffdf8' },
  },
  typography: {
    fontFamily: '"DM Sans", sans-serif',
    h1: { fontFamily: '"Fraunces", serif' },
    h2: { fontFamily: '"Fraunces", serif' },
    h3: { fontFamily: '"Fraunces", serif' },
    h4: { fontFamily: '"Fraunces", serif' },
  },
  shape: { borderRadius: 10 },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
