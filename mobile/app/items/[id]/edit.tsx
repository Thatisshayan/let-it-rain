import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fetchItem, updateItem } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";
import { useTheme } from "../../../src/theme";
import { useToast } from "../../../src/toast";

export default function EditItemScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
  });

  if (isLoading)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (loadError || !data)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load this item.
      </Text>
    );

  return <EditItemForm id={id} item={data.item} />;
}

function EditItemForm({
  id,
  item,
}: {
  id: string;
  item: { name: string; minStock: number; unitCost: number; unitPrice: number };
}) {
  const theme = useTheme();
  const toast = useToast();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Item updated");
      router.back();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
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
          {submitting ? "Saving..." : "Save changes"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  padded: { padding: 16, flex: 1 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  submit: { padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { fontWeight: "600" },
});
