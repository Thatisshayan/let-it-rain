import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createItem } from "../../src/api/items";
import { ApiError } from "../../src/api/client";
import { useTheme } from "../../src/theme";

export default function NewItemScreen() {
  const theme = useTheme();
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

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TextInput
        style={inputStyle}
        placeholder="Item name"
        placeholderTextColor={theme.mutedForeground}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={inputStyle}
        placeholder="Min stock"
        placeholderTextColor={theme.mutedForeground}
        keyboardType="numeric"
        value={minStock}
        onChangeText={setMinStock}
      />
      <TextInput
        style={inputStyle}
        placeholder="Initial quantity"
        placeholderTextColor={theme.mutedForeground}
        keyboardType="numeric"
        value={initialQuantity}
        onChangeText={setInitialQuantity}
      />
      <TextInput
        style={inputStyle}
        placeholder="Unit cost"
        placeholderTextColor={theme.mutedForeground}
        keyboardType="numeric"
        value={unitCost}
        onChangeText={setUnitCost}
      />
      <TextInput
        style={inputStyle}
        placeholder="Unit price"
        placeholderTextColor={theme.mutedForeground}
        keyboardType="numeric"
        value={unitPrice}
        onChangeText={setUnitPrice}
      />
      {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
      <Pressable style={[styles.submit, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={submitting}>
        <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
          {submitting ? "Saving..." : "Create item"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  submit: { padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { fontWeight: "600" },
});
