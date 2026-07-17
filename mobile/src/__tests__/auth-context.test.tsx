import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const clientMocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  clearToken: vi.fn(),
  getFaceIdEnabled: vi.fn(),
}));

const jwtMocks = vi.hoisted(() => ({
  decodeJwtPayload: vi.fn(),
  isTokenExpired: vi.fn(),
}));

const localAuthMocks = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

vi.mock("../api/client", () => clientMocks);
vi.mock("../api/jwt", () => jwtMocks);
vi.mock("expo-local-authentication", () => localAuthMocks);

type AuthSnapshot = {
  user: {
    id: string;
    email: string;
    name: string;
    permissions: string[];
    organizationId?: string;
  } | null;
  isBootstrapping: boolean;
  isLocked: boolean;
  signOut: () => Promise<void>;
  unlock: () => Promise<void>;
};

const validPayload = {
  userId: "u1",
  email: "alice@example.com",
  name: "Alice",
  permissions: ["EDIT_ITEMS"],
  organizationId: "org-1",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let renderer: ReactTestRenderer | null = null;

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderAuthProvider() {
  const { AuthProvider, useAuth } = await import("../api/AuthContext");
  let latestAuth: AuthSnapshot | null = null;

  function CaptureAuth() {
    latestAuth = useAuth() as AuthSnapshot;
    return null;
  }

  await act(async () => {
    renderer = create(
      <AuthProvider>
        <CaptureAuth />
      </AuthProvider>
    );
    await flushEffects();
  });

  return {
    getAuth() {
      if (!latestAuth) throw new Error("Auth context was not captured");
      return latestAuth;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  clientMocks.getToken.mockResolvedValue("valid-token");
  clientMocks.clearToken.mockResolvedValue(undefined);
  clientMocks.getFaceIdEnabled.mockResolvedValue(false);
  jwtMocks.decodeJwtPayload.mockReturnValue(validPayload);
  jwtMocks.isTokenExpired.mockReturnValue(false);
  localAuthMocks.hasHardwareAsync.mockResolvedValue(true);
  localAuthMocks.isEnrolledAsync.mockResolvedValue(true);
  localAuthMocks.authenticateAsync.mockResolvedValue({ success: true });
});

afterEach(() => {
  renderer?.unmount();
  renderer = null;
});

describe("AuthContext", () => {
  it("rehydrates a valid stored session on bootstrap", async () => {
    const { getAuth } = await renderAuthProvider();

    expect(clientMocks.getToken).toHaveBeenCalled();
    expect(clientMocks.getFaceIdEnabled).toHaveBeenCalled();
    expect(getAuth().user).toMatchObject({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
      permissions: ["EDIT_ITEMS"],
      organizationId: "org-1",
    });
    expect(getAuth().isBootstrapping).toBe(false);
    expect(getAuth().isLocked).toBe(false);
  });

  it("starts locked when Face ID is enabled for a valid session", async () => {
    clientMocks.getFaceIdEnabled.mockResolvedValue(true);

    const { getAuth } = await renderAuthProvider();

    expect(getAuth().user?.id).toBe("u1");
    expect(getAuth().isLocked).toBe(true);
  });

  it("clears an expired token during bootstrap", async () => {
    jwtMocks.isTokenExpired.mockReturnValue(true);

    const { getAuth } = await renderAuthProvider();

    expect(clientMocks.clearToken).toHaveBeenCalled();
    expect(getAuth().user).toBeNull();
    expect(getAuth().isBootstrapping).toBe(false);
    expect(getAuth().isLocked).toBe(false);
  });

  it("unlocks locally without biometric prompt when the device cannot authenticate", async () => {
    clientMocks.getFaceIdEnabled.mockResolvedValue(true);
    localAuthMocks.hasHardwareAsync.mockResolvedValue(false);

    const { getAuth } = await renderAuthProvider();

    expect(getAuth().isLocked).toBe(true);

    await act(async () => {
      await getAuth().unlock();
      await flushEffects();
    });

    expect(localAuthMocks.authenticateAsync).not.toHaveBeenCalled();
    expect(getAuth().isLocked).toBe(false);
  });

  it("signs out by clearing the token and resetting auth state", async () => {
    clientMocks.getFaceIdEnabled.mockResolvedValue(true);

    const { getAuth } = await renderAuthProvider();

    await act(async () => {
      await getAuth().signOut();
      await flushEffects();
    });

    expect(clientMocks.clearToken).toHaveBeenCalled();
    expect(getAuth().user).toBeNull();
    expect(getAuth().isLocked).toBe(false);
  });
});
