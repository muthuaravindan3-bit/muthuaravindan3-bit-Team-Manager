import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  sessionStorage.removeItem('shiftsync_chunk_reload');
  sessionStorage.removeItem('shiftsync_script_reload');
} catch {
  // Ignore storage restrictions in sandboxed iframes
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
