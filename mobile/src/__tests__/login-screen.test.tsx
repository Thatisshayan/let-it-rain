import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const authApiMocks = vi.hoisted(() => ({
  login: vi.fn(),
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

function MockView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockTextInput() {
  return null;
}

function MockPressable({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockSafeAreaView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/auth", () => authApiMocks);
vi.mock("../api/AuthContext", () => authContextMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("../api/client", () => ({
  ApiError: MockApiError,
}));
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

async function renderLoginScreen() {
  const LoginScreen = (await import("../../app/login")).default;
  let tree: ReactTestRenderer | null = null;

  await act(async () => {
    tree = create(<LoginScreen />);
  });

  return tree!;
}

describe("login screen", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authContextMocks.useAuth.mockReturnValue({
      setUser: vi.fn(),
    });
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

  it("logs in successfully, stores the user in auth state, and redirects to the dashboard", async () => {
    const user = { id: "u1", email: "a@example.com", name: "Alice", permissions: ["EDIT_ITEMS"] };
    const setUser = vi.fn();
    authContextMocks.useAuth.mockReturnValue({ setUser });
    authApiMocks.login.mockResolvedValue(user);

    const tree = await renderLoginScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const buttons = tree.root.findAllByType(MockPressable);
    const button = buttons.find((b) => b.props.children.props.children === "Sign in");

    await act(async () => {
      inputs[0].props.onChangeText("a@example.com");
      inputs[1].props.onChangeText("secret");
    });

    await act(async () => {
      await button!.props.onPress();
    });

    expect(authApiMocks.login).toHaveBeenCalledWith("a@example.com", "secret");
    expect(setUser).toHaveBeenCalledWith(user);
    expect(routerMocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the API error message when login fails with an ApiError", async () => {
    authApiMocks.login.mockRejectedValue(new MockApiError(401, "Invalid credentials"));

    const tree = await renderLoginScreen();
    const inputs = tree.root.findAllByType(MockTextInput);
    const buttons = tree.root.findAllByType(MockPressable);
    const button = buttons.find((b) => b.props.children.props.children === "Sign in");

    await act(async () => {
      inputs[0].props.onChangeText("a@example.com");
      inputs[1].props.onChangeText("wrong-password");
    });

    await act(async () => {
      await button!.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Invalid credentials" })).toHaveLength(1);
    expect(routerMocks.replace).not.toHaveBeenCalled();
  });

  it("falls back to a generic error message for unexpected failures", async () => {
    authApiMocks.login.mockRejectedValue(new Error("boom"));

    const tree = await renderLoginScreen();
    const buttons = tree.root.findAllByType(MockPressable);
    const button = buttons.find((b) => b.props.children.props.children === "Sign in");

    await act(async () => {
      await button!.props.onPress();
    });

    expect(tree.root.findAllByProps({ children: "Could not sign in." })).toHaveLength(1);
    expect(routerMocks.replace).not.toHaveBeenCalled();
  });
});