import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Captura from './pages/Captura';
import Analisis from './pages/Analisis';
import AnalisisMasivo from './pages/AnalisisMasivo';
import ProcesarCapturas from './pages/ProcesarCapturas';
import Reportes from './pages/Reportes';
import Navbar from './components/Navbar';
import FooterArt from './components/FooterArt';
import IntroToLogin from './components/IntroToLogin';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AppContent() {
  const { isAuthenticated } = useAuth();

  // Show intro animation every time when not authenticated
  if (!isAuthenticated) {
    return <IntroToLogin />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-neutral-bg to-caki">
      {isAuthenticated && <Navbar />}
      <main className={isAuthenticated ? 'pt-20' : ''}>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/captura" element={isAuthenticated ? <Captura /> : <Navigate to="/login" />} />
          <Route path="/procesar-capturas" element={isAuthenticated ? <ProcesarCapturas /> : <Navigate to="/login" />} />
          <Route path="/analisis" element={isAuthenticated ? <Analisis /> : <Navigate to="/login" />} />
          <Route path="/analisis-masivo" element={isAuthenticated ? <AnalisisMasivo /> : <Navigate to="/login" />} />
          <Route path="/reportes" element={isAuthenticated ? <Reportes /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </main>
      {isAuthenticated && <FooterArt />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;