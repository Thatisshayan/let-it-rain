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
};

const light: Theme = {
  scheme: "light",
  background: "#fafafa",
  foreground: "#1a1a2e",
  card: "#ffffff",
  border: "#e5e5ea",
  muted: "#f0f0f5",
  mutedForeground: "#6b6b7a",
  primary: "#3b5fd6",
  primaryForeground: "#fafafa",
  destructive: "#dc4444",
  warning: "#a5690a",
  warningBackground: "#fdf3e0",
  success: "#1f9d5c",
  rain: "#1a9db3",
};

const dark: Theme = {
  scheme: "dark",
  background: "#17171f",
  foreground: "#ececf0",
  card: "#242434",
  border: "#33333f",
  muted: "#2b2b38",
  mutedForeground: "#a8a8b8",
  primary: "#7ea0f0",
  primaryForeground: "#17171f",
  destructive: "#e2645a",
  warning: "#dbab5c",
  warningBackground: "#332711",
  success: "#6bc79a",
  rain: "#7fd4e0",
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
