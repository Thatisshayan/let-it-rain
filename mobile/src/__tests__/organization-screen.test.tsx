import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const settingsMocks = vi.hoisted(() => ({
  fetchOrgSettings: vi.fn(),
  updateOrgSettings: vi.fn(),
  fetchOrgInfo: vi.fn(),
  startCheckout: vi.fn(),
}));

const authContextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const permissionsMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(),
}));

const hapticsMocks = vi.hoisted(() => ({
  notificationAsync: vi.fn(),
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
  },
}));

const linkingMocks = vi.hoisted(() => ({
  openURL: vi.fn(),
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

function MockScrollView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockActivityIndicator() {
  return <>spinner</>;
}

vi.mock("../api/settings", () => settingsMocks);
vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../lib/permissions", () => permissionsMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
vi.mock("expo-haptics", () => hapticsMocks);
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  ScrollView: MockScrollView,
  ActivityIndicator: MockActivityIndicator,
  Linking: linkingMocks,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

async function flushEffects() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderOrganizationScreen() {
  const OrganizationScreen = (await import("../../app/settings/organization")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<OrganizationScreen />);
    await flushEffects();
  });

  return tree!;
}

describe("organization settings screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      user: { id: "u1", permissions: ["MANAGE_SETTINGS"] },
    });
    permissionsMocks.hasPermission.mockReturnValue(true);
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
    settingsMocks.fetchOrgSettings.mockResolvedValue({
      businessName: "Let It Rain",
      defaultLowStock: 5,
    });
    settingsMocks.fetchOrgInfo.mockResolvedValue({
      name: "Let It Rain",
      plan: "FREE",
      planLabel: "Free",
      seatLimit: 3,
      subscriptionStatus: "NONE",
      emailVerified: true,
      usage: { activeUsers: 1 },
    });
    settingsMocks.updateOrgSettings.mockResolvedValue({ ok: true });
    settingsMocks.startCheckout.mockResolvedValue({ url: "https://checkout.example.test" });
  });

  it("shows a local deny state when the user lacks MANAGE_SETTINGS", async () => {
    permissionsMocks.hasPermission.mockReturnValue(false);

    const tree = await renderOrganizationScreen();

    expect(tree.root.findAllByProps({ children: "You don't have permission to manage organization settings." })).toHaveLength(1);
  });

  it("loads org settings and saves valid updates", async () => {
    const tree = await renderOrganizationScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const saveButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      inputs[0].props.onChangeText("Rain HQ");
      inputs[1].props.onChangeText("7");
    });

    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(settingsMocks.updateOrgSettings).toHaveBeenCalledWith({
      businessName: "Rain HQ",
      defaultLowStock: 7,
    });
    expect(hapticsMocks.notificationAsync).toHaveBeenCalledWith(hapticsMocks.NotificationFeedbackType.Success);
    expect(tree.root.findAllByProps({ children: "Organization settings saved." })).toHaveLength(1);
  });

  it("shows validation for an invalid low-stock threshold", async () => {
    const tree = await renderOrganizationScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const saveButton = tree.root.findAllByType(MockPressable).at(-1)!;

    await act(async () => {
      inputs[1].props.onChangeText("-1");
    });

    await act(async () => {
      await saveButton.props.onPress();
    });

    expect(settingsMocks.updateOrgSettings).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ children: "Default low stock must be a whole number ≥ 0." })).toHaveLength(1);
  });

  it("opens checkout when upgrading from the free plan", async () => {
    const tree = await renderOrganizationScreen();
    const upgradeButton = tree.root.findAllByType(MockPressable)[0];

    await act(async () => {
      await upgradeButton.props.onPress();
    });

    expect(settingsMocks.startCheckout).toHaveBeenCalledWith("PRO");
    expect(linkingMocks.openURL).toHaveBeenCalledWith("https://checkout.example.test");
  });
});
