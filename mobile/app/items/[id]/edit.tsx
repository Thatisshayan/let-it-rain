import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItem, updateItem } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id) });
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data) return;
    setName(data.item.name);
    setMinStock(String(data.item.minStock));
    setUnitCost(String(data.item.unitCost));
    setUnitPrice(String(data.item.unitPrice));
  }, [data]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await updateItem(id, {
        name,
        minStock: Number(minStock) || 0,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["item", id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
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
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Save changes"}</Text>
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
