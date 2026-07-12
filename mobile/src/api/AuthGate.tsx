import { useEffect } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext";

/**
 * Renders a Face ID lock screen instead of `children` whenever the user has
 * Face ID enabled and the app just cold-started (or resumed locked). Wraps
 * the whole navigator so every route is gated, not just specific screens.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLocked, unlock } = useAuth();

  useEffect(() => {
    if (isLocked) {
      unlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  if (!isLocked) return <>{children}</>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Let It Rain is locked</Text>
      <Pressable style={styles.button} onPress={unlock}>
        <Text style={styles.buttonText}>Unlock with Face ID</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: "600" },
  button: { backgroundColor: "#2563eb", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
