import { Navigate, Outlet } from "react-router";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0 text-text-secondary">
        Oturum kontrol ediliyor...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}