import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { updateOwnProfile, changeOwnPassword, revokeOwnSessions } from "../../src/api/settings";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/api/AuthContext";
import { useTheme } from "../../src/theme";

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
      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Name</Text>
      <TextInput style={inputStyle} value={name} onChangeText={setName} />
      {nameError ? <Text style={{ color: theme.destructive }}>{nameError}</Text> : null}
      {nameSuccess ? <Text style={{ color: theme.success }}>{nameSuccess}</Text> : null}
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={saveName}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Save name</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Change password</Text>
      <TextInput
        style={inputStyle}
        placeholder="Current password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={inputStyle}
        placeholder="New password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {passwordError ? <Text style={{ color: theme.destructive }}>{passwordError}</Text> : null}
      {passwordSuccess ? <Text style={{ color: theme.success }}>{passwordSuccess}</Text> : null}
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={savePassword}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Change password</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Sessions</Text>
      <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
        Sign out of every device. You&apos;ll need to sign in again.
      </Text>
      <Pressable
        style={[styles.button, { borderWidth: 1, borderColor: theme.border }]}
        onPress={handleSignOutEverywhere}
        disabled={signingOutEverywhere}
      >
        <Text style={{ color: theme.foreground, fontWeight: "600" }}>
          {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  button: { padding: 12, borderRadius: 8, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "600" },
});
