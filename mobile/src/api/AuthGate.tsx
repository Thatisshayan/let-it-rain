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
      <Text style={styles.icon}>🔒</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>Let It Rain is locked</Text>
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={unlock}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Unlock with Face ID</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: "600" },
  button: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { fontWeight: "600" },
});
