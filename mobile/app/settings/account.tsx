import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { updateOwnProfile, changeOwnPassword } from "../../src/api/settings";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/api/AuthContext";

export default function AccountScreen() {
  const { user } = useAuth();
  // Remount (and re-derive initial state) whenever the loaded user identity changes,
  // instead of syncing via an effect.
  return <AccountForm key={user?.id ?? "loading"} initialName={user?.name ?? ""} />;
}

function AccountForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  async function saveName() {
    setNameError(null);
    setNameSuccess(null);
    try {
      await updateOwnProfile(name);
      setNameSuccess("Name updated.");
    } catch (err) {
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
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      {nameSuccess ? <Text style={styles.success}>{nameSuccess}</Text> : null}
      <Pressable style={styles.button} onPress={saveName}>
        <Text style={styles.buttonText}>Save name</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Change password</Text>
      <TextInput
        style={styles.input}
        placeholder="Current password"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
      {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}
      <Pressable style={styles.button} onPress={savePassword}>
        <Text style={styles.buttonText}>Change password</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  success: { color: "#080" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
