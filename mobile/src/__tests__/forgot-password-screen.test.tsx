import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
}));

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockTextInput(props: any) {
  return null;
}

function MockPressable({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return <>{children}</>;
}

function MockSafeAreaView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../theme", () => themeMocks);
vi.mock("expo-router", () => ({
  router: routerMocks,
}));
vi.mock("react-native", () => ({
  View: MockView,
  Text: MockText,
  TextInput: MockTextInput,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: MockSafeAreaView,
}));

async function renderForgotPasswordScreen() {
  const ForgotPasswordScreen = (await import("../../app/forgot-password")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<ForgotPasswordScreen />);
  });

  return tree!;
}

describe("forgot password screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      border: "#999",
      mutedForeground: "#777",
      destructive: "#f33",
      primary: "#09f",
      primaryForeground: "#111",
    });
  });

  it("renders the forgot password form", async () => {
    const tree = await renderForgotPasswordScreen();

    expect(tree.root.findAllByProps({ children: "Forgot password" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Reset your password" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Enter your email address and we'll send you a link to reset your password." })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Email" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Send reset link" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Back to sign in" })).toHaveLength(1);
  });

  it("shows success message after submitting with valid email", async () => {
    const tree = await renderForgotPasswordScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const sendButton = buttons.find((b) => b.props.children.props.children === "Send reset link");

    await act(async () => {
      sendButton!.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Check your email" })).toHaveLength(1);
    expect(tree.root.findAllByProps({ children: "Password reset email sent" })).toHaveLength(1);
    expect(routerMocks.back).not.toHaveBeenCalled();
  });

  it("navigates back when pressing the back button", async () => {
    const tree = await renderForgotPasswordScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const backButton = buttons.find((b) => b.props.children.props.children === "Back to sign in");

    await act(async () => {
      backButton!.props.onPress();
    });

    expect(routerMocks.back).toHaveBeenCalled();
  });
});