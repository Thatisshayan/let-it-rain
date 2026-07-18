import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { updateOwnProfile, changeOwnPassword, revokeOwnSessions } from "../../src/api/settings";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/api/AuthContext";
import { useTheme } from "../../src/theme";
import { ScreenHeader, Surface } from "../../src/ui/command";

export default function AccountScreen() {
  const { user } = useAuth();
  // Remount (and re-derive initial state) whenever the loaded user identity changes,
  // instead of syncing via an effect.
  return <AccountForm key={user?.id ?? "loading"} initialName={user?.name ?? ""} />;
}

function AccountForm({ initialName }: { initialName: string }) {
  const theme = useTheme();
  const { signOut } = useAuth();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  async function saveName() {
    setNameError(null);
    setNameSuccess(null);
    try {
      await updateOwnProfile(name);
      setNameSuccess("Name updated.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setNameError(err instanceof ApiError ? err.message : "Could not update name.");
    }
  }

  async function savePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess("Password changed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    }
  }

  async function handleSignOutEverywhere() {
    if (signingOutEverywhere) return;
    setSigningOutEverywhere(true);
    try {
      await revokeOwnSessions();
      await signOut();
      router.replace("/login");
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Sign out failed",
        err instanceof ApiError ? err.message : "Could not sign out everywhere."
      );
      setSigningOutEverywhere(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="Account"
        title="Manage your identity and device access."
        description="Keep profile, password, and active sessions under tight control from one surface."
      />
      <Surface theme={theme}>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Name</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          value={name}
          onChangeText={setName}
          accessibilityLabel="Your name"
          textContentType="name"
        />
        {nameError ? <Text accessibilityRole="alert" style={{ color: theme.destructive }}>{nameError}</Text> : null}
        {nameSuccess ? <Text accessibilityRole="alert" style={{ color: theme.success }}>{nameSuccess}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={saveName} accessibilityRole="button" accessibilityLabel="Save name">
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Save name</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Change password</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Current password"
          placeholderTextColor={theme.mutedForeground}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          accessibilityLabel="Current password"
          textContentType="password"
        />
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="New password"
          placeholderTextColor={theme.mutedForeground}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          accessibilityLabel="New password"
          textContentType="newPassword"
        />
        {passwordError ? <Text accessibilityRole="alert" style={{ color: theme.destructive }}>{passwordError}</Text> : null}
        {passwordSuccess ? <Text accessibilityRole="alert" style={{ color: theme.success }}>{passwordSuccess}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={savePassword} accessibilityRole="button" accessibilityLabel="Change password">
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Change password</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Sessions</Text>
        <Text style={[styles.helperText, { color: theme.mutedForeground }]}>
          Sign out of every device. You&apos;ll need to sign in again.
        </Text>
        <Pressable
          style={[styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
          onPress={handleSignOutEverywhere}
          disabled={signingOutEverywhere}
          accessibilityRole="button"
          accessibilityLabel="Sign out everywhere"
          accessibilityState={{ disabled: signingOutEverywhere }}
        >
          <Text style={[styles.buttonText, { color: theme.foreground }]}>
            {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
          </Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  sectionTitle: { fontWeight: "700", fontSize: 16, marginTop: 12, marginBottom: 6 },
  helperText: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  button: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 4 },
  buttonSecondary: { padding: 16, borderRadius: 18, borderWidth: 1, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "700" },
});
