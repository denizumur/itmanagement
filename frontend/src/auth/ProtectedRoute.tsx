import { Navigate, Outlet } from "react-router";
import type { UserRole } from "../types/auth";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  fallbackPath?: string;
}

export function ProtectedRoute({
  allowedRoles,
  fallbackPath = "/login",
}: ProtectedRouteProps) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

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

  const role = user?.role;

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    if (role === "requester") {
      return <Navigate to="/my-tickets" replace />;
    }

    if (role === "approver") {
      return <Navigate to="/approvals" replace />;
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}