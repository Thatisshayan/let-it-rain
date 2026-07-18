import { useColorScheme } from "react-native";

/**
 * Hand-picked hex approximations of the web app's OKLCH palette
 * (src/app/globals.css's :root / .dark blocks). React Native's StyleSheet
 * doesn't support oklch(), so these are visually-matched hex values, not a
 * precise color-space conversion — close enough for a mobile UI that's
 * mostly flat colors (buttons, borders, text), not gradients/blur effects.
 */
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
};

const dark: Theme = {
  ...light,
  scheme: "dark",
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
