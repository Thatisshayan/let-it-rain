import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { adjustStock } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";

const TYPES = ["RECEIVE", "REMOVE", "ADJUST"] as const;

export default function AdjustStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [type, setType] = useState<(typeof TYPES)[number]>("RECEIVE");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  async function onSubmit() {
    setError(null);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) {
      setError("Enter a valid number.");
      return;
    }
    setSubmitting(true);
    try {
      if (type === "ADJUST") {
        await adjustStock(id, { type: "ADJUST", counted: numeric, reason: reason || undefined });
      } else {
        await adjustStock(id, { type, amount: numeric, reason: reason || undefined });
      }
      await queryClient.invalidateQueries({ queryKey: ["item", id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeButton, type === t && styles.typeButtonActive]}
            onPress={() => setType(t)}
          >
            <Text style={type === t ? styles.typeTextActive : undefined}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={type === "ADJUST" ? "Counted quantity" : "Amount"}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput style={styles.input} placeholder="Reason (optional)" value={reason} onChangeText={setReason} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Save"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  typeButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
