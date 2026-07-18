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
import { useTheme } from "../../../src/theme";
import { hasPermission } from "../../../src/lib/permissions";
import { ScreenHeader, Surface } from "../../../src/ui/command";

type TargetUser = { id: string; name: string; email: string; active: boolean; permissions: string[] };

export default function UserDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const canManageUsers = hasPermission(currentUser, "MANAGE_USERS");
  const { data: users, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: canManageUsers,
  });
  const target = users?.find((u) => u.id === id);

  if (!canManageUsers) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.padded, { color: theme.destructive }]}>You don&apos;t have permission to manage users.</Text>
      </View>
    );
  }

  if (isLoading)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (loadError) {
    return (
      <View style={[styles.padded, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>Could not load this user.</Text>
        <Pressable onPress={() => refetch()}>
          <Text style={{ color: theme.primary }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!target)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>User not found.</Text>;

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
  const theme = useTheme();
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="User profile"
        title={target.name}
        description={target.email}
      />
      <Surface theme={theme}>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Permissions</Text>
        <View style={styles.permissions}>
          {ALL_PERMISSIONS.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.permButton,
                { borderColor: theme.border, backgroundColor: theme.surfaceStrong },
                permissions.includes(p) && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => togglePermission(p)}
            >
              <Text style={{ color: permissions.includes(p) ? theme.primaryForeground : theme.foreground }}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={savePermissions} disabled={saving}>
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>
            {saving ? "Saving..." : "Save permissions"}
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Status</Text>
        <Pressable
          style={[styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
          onPress={toggleActive}
          disabled={isSelf && target.active}
        >
          <Text style={{ color: theme.foreground }}>{target.active ? "Deactivate" : "Activate"}</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Reset password</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.surfaceStrong }]}
          placeholder="New password"
          placeholderTextColor={theme.mutedForeground}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]} onPress={submitResetPassword}>
          <Text style={{ color: theme.foreground }}>Reset password</Text>
        </Pressable>

        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  padded: { padding: 16, flex: 1 },
  sectionTitle: { fontWeight: "700", fontSize: 16, marginTop: 12, marginBottom: 6 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  button: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 8 },
  buttonText: { fontWeight: "700" },
  buttonSecondary: { padding: 14, borderRadius: 18, borderWidth: 1, alignItems: "center", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
});
