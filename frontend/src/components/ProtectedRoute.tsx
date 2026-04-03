import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasAnyRole } from '../lib/rbac';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, roles } = useAuth();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-gray-500">
        Validando sesión...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasAnyRole(roles, allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
