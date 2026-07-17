import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, create } from "react-test-renderer";

const authMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const themeMocks = vi.hoisted(() => ({
  useTheme: vi.fn(),
}));

function MockText({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockPressable({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return <>{children}</>;
}

function MockSafeAreaView({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function VisibleChild() {
  return <>visible-child</>;
}

vi.mock("../api/AuthContext", () => authMocks);
vi.mock("../theme", () => themeMocks);
vi.mock("react-native", () => ({
  Text: MockText,
  Pressable: MockPressable,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: MockSafeAreaView,
}));

describe("AuthGate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({
      isLocked: false,
      unlock: vi.fn(),
    });
    themeMocks.useTheme.mockReturnValue({
      background: "#000",
      foreground: "#fff",
      primary: "#09f",
      primaryForeground: "#111",
    });
  });

  it("renders children immediately when the app is not locked", async () => {
    const { AuthGate } = await import("../api/AuthGate");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(
        <AuthGate>
          <VisibleChild />
        </AuthGate>
      );
    });

    expect(tree!.root.findAllByType(VisibleChild)).toHaveLength(1);
  });

  it("auto-invokes unlock and renders the lock screen when locked", async () => {
    const unlock = vi.fn();
    authMocks.useAuth.mockReturnValue({
      isLocked: true,
      unlock,
    });
    const { AuthGate } = await import("../api/AuthGate");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(
        <AuthGate>
          <VisibleChild />
        </AuthGate>
      );
    });

    expect(unlock).toHaveBeenCalledTimes(1);
    expect(tree!.root.findAllByProps({ children: "Let It Rain is locked" })).toHaveLength(1);
    expect(tree!.root.findAllByProps({ children: "Unlock with Face ID" })).toHaveLength(1);
    expect(tree!.root.findAllByType(VisibleChild)).toHaveLength(0);
  });

  it("lets the user retry unlock from the lock screen button", async () => {
    const unlock = vi.fn();
    authMocks.useAuth.mockReturnValue({
      isLocked: true,
      unlock,
    });
    const { AuthGate } = await import("../api/AuthGate");
    let tree: ReturnType<typeof create> | null = null;

    await act(async () => {
      tree = create(
        <AuthGate>
          <VisibleChild />
        </AuthGate>
      );
    });

    const pressable = tree!.root.findByType(MockPressable);

    await act(async () => {
      pressable.props.onPress();
    });

    expect(unlock).toHaveBeenCalledTimes(2);
  });
});
