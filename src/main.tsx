import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { InviteRegistration } from './components/InviteRegistration.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/notification-sw.js').catch(error => {
      console.error('No se pudo registrar el servicio de notificaciones:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {window.location.pathname === '/inicio' ? <LandingPage /> : window.location.pathname === '/registro' ? <InviteRegistration /> : <App />}
    </ThemeProvider>
  </StrictMode>
);
