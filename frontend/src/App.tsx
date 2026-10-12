import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Captura from './pages/Captura';
import Analisis from './pages/Analisis';
import AnalisisMasivo from './pages/AnalisisMasivo';
import ProcesarCapturas from './pages/ProcesarCapturas';
import HistorialOperador from './pages/HistorialOperador';
import Navbar from './components/Navbar';
import FooterArt from './components/FooterArt';
import IntroToLogin from './components/IntroToLogin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { ROLE_ADMIN, ROLE_ANALISTA, ROLE_DEV, ROLE_OPERADOR } from './lib/rbac';
import UsuariosAdmin from './pages/admin/UsuariosAdmin';
import RolesAdmin from './pages/admin/RolesAdmin';
import DispositivosAdmin from './pages/admin/DispositivosAdmin';
import ConfiguracionesSistema from './pages/admin/ConfiguracionesSistema';
import Catalogos from './pages/admin/Catalogos';
import Perfil from './pages/admin/Perfil';
import { PresentationProvider, usePresentation } from './contexts/PresentationContext';
import { ToastProvider } from './components/ui/Toast';

const Reportes = React.lazy(() => import('./pages/Reportes'));
const ReportesGenerados = React.lazy(() => import('./pages/admin/ReportesGenerados'));
const Placas = React.lazy(() => import('./pages/Placas'));

const PageSpinner = () => (
  <div className="flex min-h-[400px] items-center justify-center">
    <div className="text-center">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-rojo-tinto" />
      <p className="mt-4 text-gray-500">Cargando…</p>
    </div>
  </div>
);

function AppContent() {
 const { isAuthenticated, loading } = useAuth();
  const { active: presentacionActiva } = usePresentation();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-bg flex items-center justify-center text-gray-600">
        Cargando sesión...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <IntroToLogin />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-neutral-bg to-caki">
      {isAuthenticated && !presentacionActiva && <Navbar />}
      <main className={isAuthenticated ? 'pt-20' : ''}>
        <Suspense fallback={<PageSpinner />}>
        <Routes>
                   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/captura" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><Captura /></ProtectedRoute>} />
          <Route path="/procesar-capturas" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><ProcesarCapturas /></ProtectedRoute>} />
          <Route path="/analisis" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><Analisis /></ProtectedRoute>} />
          <Route path="/analisis-masivo" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><AnalisisMasivo /></ProtectedRoute>} />
          <Route path="/placas" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><Placas /></ProtectedRoute>} />
          <Route path="/reportes" element={<ProtectedRoute allowedRoles={[ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><Reportes /></ProtectedRoute>} />
          <Route path="/mi-historial" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ADMIN, ROLE_DEV]}><HistorialOperador /></ProtectedRoute>} />

          <Route path="/usuarios" element={<ProtectedRoute allowedRoles={[ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><UsuariosAdmin /></ProtectedRoute>} />
          <Route path="/roles" element={<ProtectedRoute allowedRoles={[ROLE_ADMIN, ROLE_DEV]}><RolesAdmin /></ProtectedRoute>} />
          <Route path="/dispositivos" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><DispositivosAdmin /></ProtectedRoute>} />
          <Route path="/configuraciones" element={<ProtectedRoute allowedRoles={[ROLE_ADMIN, ROLE_DEV]}><ConfiguracionesSistema /></ProtectedRoute>} />
          <Route path="/catalogos" element={<ProtectedRoute allowedRoles={[ROLE_OPERADOR, ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><Catalogos /></ProtectedRoute>} />
          <Route path="/reportes-generados" element={<ProtectedRoute allowedRoles={[ROLE_ANALISTA, ROLE_ADMIN, ROLE_DEV]}><ReportesGenerados /></ProtectedRoute>} />
          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />

          <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
        </Routes>
        </Suspense>
      </main>
      {isAuthenticated && !presentacionActiva && <FooterArt />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <PresentationProvider>
        <ToastProvider>
          <Router>
            <AppContent />
          </Router>
        </ToastProvider>
      </PresentationProvider>
    </AuthProvider>
  );
}

export default App;
