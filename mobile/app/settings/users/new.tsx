import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createUser, ALL_PERMISSIONS } from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";

export default function NewUserScreen() {
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

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Creating..." : "Create user"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  permButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  permTextActive: { color: "#fff" },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
