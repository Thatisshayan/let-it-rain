import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

function MockActivityIndicator({ color }: { color?: string }) {
  return <>{`spinner:${color ?? ""}`}</>;
}

function MockRedirect({ href }: { href: string }) {
  return <>{`redirect:${href}`}</>;
}

function MockSafeAreaView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

vi.mock("../api/AuthContext", () => authMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("react-native", () => ({
  ActivityIndicator: MockActivityIndicator,
}));
vi.mock("expo-router", () => ({
  Redirect: MockRedirect,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: MockSafeAreaView,
}));

describe("mobile index route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      primary: "#09f",
    });
  });

  it("shows a loading state while auth bootstrap is in progress", async () => {
    authMocks.useAuth.mockReturnValue({
      user: null,
      isBootstrapping: true,
    });
    const Index = (await import("../../app/index")).default;
    let tree: ReactTestRenderer | null = null;

    await act(async () => {
      tree = create(<Index />);
    });

    expect(tree!.root.findAllByType(MockActivityIndicator)).toHaveLength(1);
    expect(tree!.root.findAllByProps({ children: "redirect:/login" })).toHaveLength(0);
    expect(tree!.root.findAllByProps({ children: "redirect:/dashboard" })).toHaveLength(0);
  });

  it("redirects signed-in users to the dashboard once bootstrap completes", async () => {
    authMocks.useAuth.mockReturnValue({
      user: { id: "u1" },
      isBootstrapping: false,
    });
    const Index = (await import("../../app/index")).default;
    let tree: ReactTestRenderer | null = null;

    await act(async () => {
      tree = create(<Index />);
    });

    expect(tree!.root.findByType(MockRedirect).props.href).toBe("/dashboard");
  });

  it("redirects signed-out users to login once bootstrap completes", async () => {
    authMocks.useAuth.mockReturnValue({
      user: null,
      isBootstrapping: false,
    });
    const Index = (await import("../../app/index")).default;
    let tree: ReactTestRenderer | null = null;

    await act(async () => {
      tree = create(<Index />);
    });

    expect(tree!.root.findByType(MockRedirect).props.href).toBe("/login");
  });
});
