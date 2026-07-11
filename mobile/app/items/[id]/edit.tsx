import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItem, updateItem } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
  });

  if (isLoading) return <Text style={styles.padded}>Loading...</Text>;
  if (loadError || !data)
    return <Text style={[styles.padded, styles.error]}>Could not load this item.</Text>;

  return <EditItemForm id={id} item={data.item} />;
}

function EditItemForm({
  id,
  item,
}: {
  id: string;
  item: { name: string; minStock: number; unitCost: number; unitPrice: number };
}) {
  const [name, setName] = useState(item.name);
  const [minStock, setMinStock] = useState(String(item.minStock));
  const [unitCost, setUnitCost] = useState(String(item.unitCost));
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

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
  padded: { padding: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
