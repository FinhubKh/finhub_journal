import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppChrome({ children }) {
  return (
    <>
      <div id="confetti-container" aria-hidden="true" />
      {children}
    </>
  );
}

export default function App() {
  const { ready } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('nxuu_theme', 'light');
  }, []);

  return (
    !ready ? null : (
      <BrowserRouter>
        <AppChrome>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<GuestRoute><AuthPage /></GuestRoute>} />
            <Route
              path="/dashboard"
              element={(
                <ProtectedRoute>
                  <AppDataProvider>
                    <DashboardPage />
                  </AppDataProvider>
                </ProtectedRoute>
              )}
            />
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppChrome>
      </BrowserRouter>
    )
  );
}
