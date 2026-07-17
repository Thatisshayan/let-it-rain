import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const settingsMocks = vi.hoisted(() => ({
  updateOwnProfile: vi.fn(),
  changeOwnPassword: vi.fn(),
  revokeOwnSessions: vi.fn(),
}));

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

const hapticsMocks = vi.hoisted(() => ({
  notificationAsync: vi.fn(),
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
  },
}));

const alertMocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

class MockApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockTextInput(_: Record<string, unknown>) {
  return null;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/settings", () => settingsMocks);
vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("expo-haptics", () => hapticsMocks);
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Alert: alertMocks,
}));

async function renderAccountScreen() {
  const AccountScreen = (await import("../../app/settings/account")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<AccountScreen />);
  });

  return tree!;
}

describe("account screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", name: "Alice" },
      signOut: vi.fn(),
    });
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      success: "#0f0",
      primary: "#09f",
      primaryForeground: "#111",
    });
  });

  it("revokes sessions, signs out locally, and redirects to login", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", name: "Alice" },
      signOut,
    });
    settingsMocks.revokeOwnSessions.mockResolvedValue(undefined);

    const tree = await renderAccountScreen();
    const signOutButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      await signOutButton.props.onPress();
    });

    expect(settingsMocks.revokeOwnSessions).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
    expect(routerMocks.replace).toHaveBeenCalledWith("/login");
  });

  it("shows an alert and stays on screen when sign-out-everywhere fails", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", name: "Alice" },
      signOut,
    });
    settingsMocks.revokeOwnSessions.mockRejectedValue(new MockApiError(500, "Session revoke failed"));

    const tree = await renderAccountScreen();
    const signOutButton = tree.root.findAllByType(MockPressable)[2];

    await act(async () => {
      await signOutButton.props.onPress();
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Error);
    expect(alertMocks.alert).toHaveBeenCalledWith("Sign out failed", "Session revoke failed");
  });
});
