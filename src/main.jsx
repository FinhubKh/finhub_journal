import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './tailwind.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { ThemeProvider } from './context/ThemeContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>
);
