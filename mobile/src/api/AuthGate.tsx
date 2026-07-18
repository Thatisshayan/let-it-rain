import { useEffect } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext";
import { useTheme } from "../theme";

/**
 * Renders a Face ID lock screen instead of `children` whenever the user has
 * Face ID enabled and the app just cold-started (or resumed locked). Wraps
 * the whole navigator so every route is gated, not just specific screens.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { isLocked, unlock } = useAuth();

  useEffect(() => {
    if (isLocked) {
      unlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  if (!isLocked) return <>{children}</>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>Secure workspace</Text>
      <Text style={[styles.badge, { color: theme.primaryForeground, backgroundColor: theme.primary }]}>LR</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>Let It Rain is locked</Text>
      <Text style={[styles.subtitle, { color: theme.foreground }]}>
        Re-enter the operations workspace with Face ID to continue.
      </Text>
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={unlock}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Unlock with Face ID</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 64,
  },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 14, lineHeight: 22, textAlign: "center", opacity: 0.8, maxWidth: 280 },
  button: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18 },
  buttonText: { fontWeight: "700" },
});
