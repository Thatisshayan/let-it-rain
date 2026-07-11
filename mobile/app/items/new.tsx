import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createItem } from "../../src/api/items";
import { ApiError } from "../../src/api/client";

export default function NewItemScreen() {
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { itemId } = await createItem({
        name,
        minStock: Number(minStock) || 0,
        initialQuantity: Number(initialQuantity) || 0,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.replace(`/items/${itemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Item name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Min stock"
        keyboardType="numeric"
        value={minStock}
        onChangeText={setMinStock}
      />
      <TextInput
        style={styles.input}
        placeholder="Initial quantity"
        keyboardType="numeric"
        value={initialQuantity}
        onChangeText={setInitialQuantity}
      />
      <TextInput
        style={styles.input}
        placeholder="Unit cost"
        keyboardType="numeric"
        value={unitCost}
        onChangeText={setUnitCost}
      />
      <TextInput
        style={styles.input}
        placeholder="Unit price"
        keyboardType="numeric"
        value={unitPrice}
        onChangeText={setUnitPrice}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Create item"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
