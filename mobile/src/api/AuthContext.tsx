import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import type { User } from "./auth";
import { getToken, clearToken, getFaceIdEnabled } from "./client";
import { decodeJwtPayload, isTokenExpired } from "./jwt";

type AuthState = {
  user: User | null;
  isBootstrapping: boolean;
  isLocked: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  unlock: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload && !isTokenExpired(payload)) {
          const faceIdEnabled = await getFaceIdEnabled();
          if (faceIdEnabled) {
            setIsLocked(true);
          }
          setUser({
            id: payload.userId,
            email: payload.email,
            name: payload.name,
            permissions: payload.permissions,
            organizationId: payload.organizationId,
          });
        } else {
          await clearToken();
        }
      }
      setIsBootstrapping(false);
    })();
  }, []);

  async function unlock() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      // No usable biometric enrolled on this device — don't lock the user out.
      setIsLocked(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Let It Rain",
    });
    if (result.success) {
      setIsLocked(false);
    }
  }

  async function signOut() {
    await clearToken();
    setUser(null);
    setIsLocked(false);
  }

  return (
    <AuthContext.Provider value={{ user, isBootstrapping, isLocked, setUser, signOut, unlock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
