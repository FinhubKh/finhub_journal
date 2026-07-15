import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PublicSharePage = lazy(() => import('./pages/PublicSharePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50">
      <span
        className="inline-block h-9 w-9 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function JournalRoute({ children }) {
  const { isAdmin, ready, profileLoading } = useAuth();
  if (!ready || profileLoading) return null;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return children;
}

function GuestRoute({ children }) {
  const { isAuthenticated, isAdmin, ready, profileLoading } = useAuth();
  if (!ready || profileLoading) return null;
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, ready, profileLoading } = useAuth();
  if (!ready || profileLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppChrome({ children }) {
  return (
    <>
      <div id="confetti-container" aria-hidden="true" />
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        draggable
        theme="light"
      />
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
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/share/:token" element={<PublicSharePage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/login" element={<GuestRoute><AuthPage /></GuestRoute>} />
              <Route
                path="/dashboard"
                element={(
                  <ProtectedRoute>
                    <JournalRoute>
                      <AppDataProvider>
                        <DashboardPage />
                      </AppDataProvider>
                    </JournalRoute>
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/admin"
                element={(
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                )}
              />
              <Route path="/app" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppChrome>
      </BrowserRouter>
    )
  );
}
