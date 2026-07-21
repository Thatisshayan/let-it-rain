import { useState } from "react";
import { TextInput, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from "../src/api/auth";
import { useAuth } from "../src/api/AuthContext";
import { ApiError } from "../src/api/client";
import { useTheme } from "../src/theme";

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      setUser(user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>Internal workspace</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>Let It Rain</Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        Sign in to access the mobile command surface for inventory, dispatch, activity, and reporting.
      </Text>
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Email</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: theme.border,
            color: theme.foreground,
            backgroundColor: theme.surfaceStrong,
          },
        ]}
        placeholder="Email"
        placeholderTextColor={theme.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email address"
        accessibilityRole="none"
      />
      <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Password</Text>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: theme.border,
            color: theme.foreground,
            backgroundColor: theme.surfaceStrong,
          },
        ]}
        placeholder="Password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
        accessibilityRole="none"
      />
      {error ? (
        <Text style={[styles.error, { color: theme.destructive }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={onSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={loading ? "Signing in" : "Sign in"}
        accessibilityState={{ disabled: loading }}
      >
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>
      <Text style={[styles.helper, { color: theme.mutedForeground }]}>
        Permissions and organization scope are applied immediately after sign-in.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "800", marginBottom: 4, letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 22, marginBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 16, padding: 14 },
  error: { fontSize: 13, fontWeight: "600" },
  button: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "700" },
  helper: { fontSize: 12, lineHeight: 18 },
});