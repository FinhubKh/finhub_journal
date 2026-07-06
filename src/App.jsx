import { useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import FluidBackground from './components/FluidBackground';

export default function App() {
  const { isAuthenticated, ready } = useAuth();

  return (
    <>
      <FluidBackground />
      <div className="grain-overlay" aria-hidden="true" />
      <div id="confetti-container" aria-hidden="true" />
      {!ready ? null : !isAuthenticated ? <AuthPage /> : (
        <AppDataProvider>
          <HomePage />
        </AppDataProvider>
      )}
    </>
  );
}
