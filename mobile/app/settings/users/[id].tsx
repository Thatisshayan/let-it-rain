import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  ALL_PERMISSIONS,
} from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";
import { useAuth } from "../../../src/api/AuthContext";

type TargetUser = { id: string; name: string; email: string; active: boolean; permissions: string[] };

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  const target = users?.find((u) => u.id === id);

  if (isLoading) return <Text style={styles.padded}>Loading...</Text>;
  if (loadError) {
    return (
      <View style={styles.padded}>
        <Text style={styles.error}>Could not load this user.</Text>
        <Pressable onPress={() => refetch()}>
          <Text>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!target) return <Text style={styles.padded}>User not found.</Text>;

  return <UserDetailForm id={id} target={target} isSelf={target.id === currentUser?.id} />;
}

function UserDetailForm({
  id,
  target,
  isSelf,
}: {
  id: string;
  target: TargetUser;
  isSelf: boolean;
}) {
  const [permissions, setPermissions] = useState<string[]>(target.permissions);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  function togglePermission(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function savePermissions() {
    setError(null);
    setSaving(true);
    try {
      await updateUserPermissions(id, permissions);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    setError(null);
    try {
      await setUserActive(id, !target.active);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function submitResetPassword() {
    setError(null);
    try {
      await resetUserPassword(id, newPassword);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{target.name}</Text>
      <Text>{target.email}</Text>

      <Text style={styles.sectionTitle}>Permissions</Text>
      <View style={styles.permissions}>
        {ALL_PERMISSIONS.map((p) => (
          <Pressable
            key={p}
            style={[styles.permButton, permissions.includes(p) && styles.permButtonActive]}
            onPress={() => togglePermission(p)}
          >
            <Text style={permissions.includes(p) ? styles.permTextActive : undefined}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={savePermissions} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save permissions"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Status</Text>
      <Pressable style={styles.buttonSecondary} onPress={toggleActive} disabled={isSelf && target.active}>
        <Text>{target.active ? "Deactivate" : "Activate"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Reset password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <Pressable style={styles.buttonSecondary} onPress={submitResetPassword}>
        <Text>Reset password</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  title: { fontSize: 22, fontWeight: "600" },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  permButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  permTextActive: { color: "#fff" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
});
