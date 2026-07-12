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
      <Text style={[styles.title, { color: theme.foreground }]}>Let It Rain</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
        placeholder="Email"
        placeholderTextColor={theme.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
        placeholder="Password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={[styles.error, { color: theme.destructive }]}>{error}</Text> : null}
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={loading}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>
          {loading ? "Signing in..." : "Sign in"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  error: {},
  button: { padding: 14, borderRadius: 8, alignItems: "center" },
  buttonText: { fontWeight: "600" },
});
