import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const permissionsMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}));

const clientMocks = vi.hoisted(() => ({
  getFaceIdEnabled: vi.fn(),
  setFaceIdEnabled: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

const localAuthenticationMocks = vi.hoisted(() => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  authenticateAsync: vi.fn(),
}));

const alertMocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockSwitch(_: Record<string, unknown>) {
  return null;
}

vi.mock("../../src/api/AuthContext", () => authContextMocks);
vi.mock("../../src/theme", () => themeMocks);
vi.mock("../../src/lib/permissions", () => permissionsMocks);
vi.mock("../../src/api/client", () => clientMocks);
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("expo-local-authentication", () => localAuthenticationMocks);
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  Pressable: MockPressable,
  Switch: MockSwitch,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Alert: alertMocks,
}));

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderSettingsScreen() {
  const SettingsScreen = (await import("../../app/(tabs)/settings")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<SettingsScreen />);
    await flushEffects();
  });

  return tree!;
}

describe("settings screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
      signOut: vi.fn().mockResolvedValue(undefined),
    });
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      destructive: "#f33",
      primary: "#09f",
    });
    permissionsMocks.hasPermission.mockImplementation((user, permission: string) =>
      user?.permissions?.includes(permission) ?? false
    );
    clientMocks.getFaceIdEnabled.mockResolvedValue(false);
    clientMocks.setFaceIdEnabled.mockResolvedValue(undefined);
    localAuthenticationMocks.hasHardwareAsync.mockResolvedValue(true);
    localAuthenticationMocks.isEnrolledAsync.mockResolvedValue(true);
    localAuthenticationMocks.authenticateAsync.mockResolvedValue({ success: true });
  });

  it("shows permission-gated rows and routes to the selected settings screens", async () => {
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["MANAGE_USERS", "MANAGE_SETTINGS"] },
      signOut: vi.fn().mockResolvedValue(undefined),
    });

    const tree = await renderSettingsScreen();
    const buttons = tree.root.findAllByType(MockPressable);

    expect(tree.root.findAllByProps({ children: "Users" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Account" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Organization & plan" })).toHaveLength(1);

    await act(async () => {
      buttons[0].props.onPress();
      buttons[1].props.onPress();
      buttons[2].props.onPress();
    });

    expect(routerMocks.push).toHaveBeenNthCalledWith(1, "/settings/users");
    expect(routerMocks.push).toHaveBeenNthCalledWith(2, "/settings/account");
    expect(routerMocks.push).toHaveBeenNthCalledWith(3, "/settings/organization");
  });

  it("hides admin-only rows when the user lacks the required permissions", async () => {
    const tree = await renderSettingsScreen();

    expect(tree.root.findAllByProps({ children: "Users" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "Organization & plan" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "Account" })).toHaveLength(1);
  });

  it("shows an alert instead of toggling Face ID when biometrics are unavailable", async () => {
    localAuthenticationMocks.hasHardwareAsync.mockResolvedValue(false);

    const tree = await renderSettingsScreen();
    const toggle = tree.root.findByType(MockSwitch);

    await act(async () => {
      toggle.props.onValueChange(true);
    });

    expect(alertMocks.alert).toHaveBeenCalledWith(
      "Face ID not available",
      "This device doesn't have Face ID set up, or it's not been enrolled in your device settings."
    );
    expect(localAuthenticationMocks.authenticateAsync).not.toHaveBeenCalled();
    expect(clientMocks.setFaceIdEnabled).not.toHaveBeenCalled();
  });

  it("authenticates before enabling Face ID and persists the setting on success", async () => {
    const tree = await renderSettingsScreen();
    const toggle = tree.root.findByType(MockSwitch);

    await act(async () => {
      await toggle.props.onValueChange(true);
    });

    expect(localAuthenticationMocks.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: "Confirm to enable Face ID unlock",
    });
    expect(clientMocks.setFaceIdEnabled).toHaveBeenCalledWith(true);
    expect(toggle.props.value).toBe(true);
  });

  it("does not persist Face ID when biometric confirmation fails", async () => {
    localAuthenticationMocks.authenticateAsync.mockResolvedValue({ success: false });

    const tree = await renderSettingsScreen();
    const toggle = tree.root.findByType(MockSwitch);

    await act(async () => {
      await toggle.props.onValueChange(true);
    });

    expect(localAuthenticationMocks.authenticateAsync).toHaveBeenCalled();
    expect(clientMocks.setFaceIdEnabled).not.toHaveBeenCalled();
    expect(toggle.props.value).toBe(false);
  });

  it("signs out locally and redirects to login", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: [] },
      signOut,
    });

    const tree = await renderSettingsScreen();
    const signOutButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      await signOutButton.props.onPress();
    });

    expect(signOut).toHaveBeenCalled();
    expect(routerMocks.replace).toHaveBeenCalledWith("/login");
  });
});
