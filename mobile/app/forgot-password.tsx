import { useState } from "react";
import { TextInput, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../src/theme";

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setError(null);
    setSent(true);
    // TODO: Implement password reset request
    // For now, just show a success message
  }

  if (sent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>Check your email</Text>
        <Text style={[styles.title, { color: theme.foreground }]}>Password reset email sent</Text>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          We've sent a password reset link to <Text style={{ fontWeight: "600" }}>{email}</Text>.
          Tap the link in your email to reset your password.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Back to sign in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>Forgot password</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>Reset your password</Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        Enter your email address and we'll send you a link to reset your password.
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
      {error ? (
        <Text style={[styles.error, { color: theme.destructive }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={onSubmit}
        disabled={!email}
        accessibilityRole="button"
        accessibilityLabel="Send reset link"
        accessibilityState={{ disabled: !email }}
      >
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Send reset link</Text>
      </Pressable>
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
        accessibilityRole="link"
        accessibilityLabel="Back to sign in"
      >
        <Text style={[styles.backText, { color: theme.primary }]}>Back to sign in</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 4, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 22, marginBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  input: { borderWidth: 1, borderRadius: 16, padding: 14 },
  error: { fontSize: 13, fontWeight: "600" },
  button: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "700" },
  backButton: { alignItems: "center", marginTop: 8 },
  backText: { fontSize: 14, fontWeight: "500" },
});