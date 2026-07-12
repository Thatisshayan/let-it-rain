import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createUser, ALL_PERMISSIONS } from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";
import { useTheme } from "../../../src/theme";

export default function NewUserScreen() {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  function togglePermission(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await createUser({ name, email, password, permissions });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
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
      <TextInput style={inputStyle} placeholder="Name" placeholderTextColor={theme.mutedForeground} value={name} onChangeText={setName} />
      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={theme.mutedForeground}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder="Password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.permissions}>
        {ALL_PERMISSIONS.map((p) => (
          <Pressable
            key={p}
            style={[
              styles.permButton,
              { borderColor: theme.border },
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { padding: 8, borderRadius: 8, borderWidth: 1 },
  submit: { padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { fontWeight: "600" },
});
