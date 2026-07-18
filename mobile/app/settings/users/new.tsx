import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createUser, ALL_PERMISSIONS } from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";
import { useToast } from "../../../src/toast";
import { useTheme } from "../../../src/theme";
import { useAuth } from "../../../src/api/AuthContext";
import { hasPermission } from "../../../src/lib/permissions";
import { ScreenHeader, Surface } from "../../../src/ui/command";

export default function NewUserScreen() {
  const theme = useTheme();
  const { user: session } = useAuth();
  const canManageUsers = hasPermission(session, "MANAGE_USERS");
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  if (!canManageUsers) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to create users.</Text>
      </View>
    );
  }

  function togglePermission(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await createUser({ name, email, password, permissions });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.show("User created");
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="New user"
        title="Provision a new operator account."
        description="Set identity, credentials, and permission scope in one tighter administrative flow."
      />
      <Surface theme={theme}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Name</Text>
        <TextInput style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]} placeholder="Name" placeholderTextColor={theme.mutedForeground} value={name} onChangeText={setName} />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Email</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Email"
          placeholderTextColor={theme.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Password</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Password"
          placeholderTextColor={theme.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Permissions</Text>
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
        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
        <Pressable style={[styles.submit, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={submitting}>
          <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
            {submitting ? "Creating..." : "Create user"}
          </Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  submit: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 8 },
  submitText: { fontWeight: "700" },
});
