import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import NavBar from './NavBar';

interface ProtectedRouteProps {
  requiredRole?: string;
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, user, fetchUser } = useAuthStore();

  useEffect(() => {
    if (isLoading) {
      fetchUser();
    }
  }, [isLoading, fetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <NavBar />
      <Outlet />
    </>
  );
}
