import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './tailwind.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DialogProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DialogProvider>
  </StrictMode>
);
