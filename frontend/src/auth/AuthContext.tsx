import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, bootstrapAuthRequest, loginRequest, logoutRequest } from "../api/http";
import { setAccessToken } from "../lib/authToken";
import type { AuthUser } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function loadMe() {
    const response = await api.get<AuthUser>("/api/auth/me/");
    setUser(response.data);
  }

  async function login(username: string, password: string) {
    const data = await loginRequest(username, password);
    setAccessToken(data.access);
    setUser(data.user);
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const data = await bootstrapAuthRequest();
        setAccessToken(data.access);
        await loadMe();
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrap();

    function handleLogout() {
      setUser(null);
    }

    window.addEventListener("auth:logout", handleLogout);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
    }),
    [user, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}