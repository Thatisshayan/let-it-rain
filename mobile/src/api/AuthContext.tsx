import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "./auth";
import { getToken, clearToken } from "./client";
import { decodeJwtPayload, isTokenExpired } from "./jwt";

type AuthState = {
  user: User | null;
  isBootstrapping: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload && !isTokenExpired(payload)) {
          setUser({
            id: payload.userId,
            email: payload.email,
            name: payload.name,
            permissions: payload.permissions,
          });
        } else {
          await clearToken();
        }
      }
      setIsBootstrapping(false);
    })();
  }, []);

  async function signOut() {
    await clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isBootstrapping, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
