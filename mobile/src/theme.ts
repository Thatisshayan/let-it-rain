import { useColorScheme } from "react-native";

export type Theme = {
  scheme: "light" | "dark";
  background: string;
  foreground: string;
  card: string;
  surface: string;
  surfaceStrong: string;
  surfaceMuted: string;
  border: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  warning: string;
  warningBackground: string;
  success: string;
  rain: string;
  shadow: string;
  state: {
    pressed: string;
    disabled: string;
    disabledForeground: string;
  };
};

const light: Theme = {
  scheme: "light",
  background: "#131824",
  foreground: "#eef2ff",
  card: "#1b2332",
  surface: "#182132",
  surfaceStrong: "#1f2a3f",
  surfaceMuted: "#121927",
  border: "#2f3b53",
  muted: "#212c42",
  mutedForeground: "#9aa7bf",
  primary: "#7b9fff",
  primaryForeground: "#0f1522",
  destructive: "#ff7d75",
  warning: "#e0b15c",
  warningBackground: "#3b2d17",
  success: "#68c49b",
  rain: "#74cfe0",
  shadow: "rgba(6, 10, 20, 0.42)",
  state: {
    pressed: "rgba(255,255,255,0.08)",
    disabled: "rgba(255,255,255,0.06)",
    disabledForeground: "rgba(238,242,255,0.3)",
  },
};

const dark: Theme = {
  scheme: "dark",
  background: "#0b0f1a",
  foreground: "#f0f4ff",
  card: "#141c2e",
  surface: "#10182a",
  surfaceStrong: "#182238",
  surfaceMuted: "#0a0f1a",
  border: "#28344a",
  muted: "#1a2438",
  mutedForeground: "#8a98b8",
  primary: "#7b9fff",
  primaryForeground: "#0f1522",
  destructive: "#ff7d75",
  warning: "#e0b15c",
  warningBackground: "#3b2d17",
  success: "#68c49b",
  rain: "#74cfe0",
  shadow: "rgba(0, 0, 0, 0.7)",
  state: {
    pressed: "rgba(255,255,255,0.06)",
    disabled: "rgba(255,255,255,0.04)",
    disabledForeground: "rgba(240,244,255,0.3)",
  },
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

export function getTheme(scheme: "light" | "dark" = "light"): Theme {
  return scheme === "dark" ? dark : light;
}

export const themes = { light, dark };