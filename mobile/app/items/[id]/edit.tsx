import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fetchItem, updateItem } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";
import { useTheme } from "../../../src/theme";
import { useToast } from "../../../src/toast";
import { useAuth } from "../../../src/api/AuthContext";
import { hasPermission } from "../../../src/lib/permissions";
import { ScreenHeader, Surface } from "../../../src/ui/command";

export default function EditItemScreen() {
  const theme = useTheme();
  const { user: session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const canEditItems = hasPermission(session, "EDIT_ITEMS");
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
    enabled: canEditItems,
  });

  if (!canEditItems) {
    return (
      <View style={[styles.padded, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to edit items.</Text>
      </View>
    );
  }

  if (isLoading)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (loadError || !data)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load this item.
      </Text>
    );

  return <EditItemForm id={id} item={data.item} canViewCosts={hasPermission(session, "VIEW_COSTS")} />;
}

function EditItemForm({
  id,
  item,
  canViewCosts,
}: {
  id: string;
  item: { name: string; minStock: number; unitCost: number; unitPrice: number };
  canViewCosts: boolean;
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
        unitCost: canViewCosts ? Number(unitCost) || 0 : 0,
        unitPrice: canViewCosts ? Number(unitPrice) || 0 : 0,
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
      <ScreenHeader
        theme={theme}
        eyebrow="Item profile"
        title={`Refine ${item.name}`}
        description="Update thresholds and pricing without leaving the active inventory workflow."
      />
      <Surface theme={theme}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Item name</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Item name"
          placeholderTextColor={theme.mutedForeground}
          value={name}
          onChangeText={setName}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Minimum stock</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Min stock"
          placeholderTextColor={theme.mutedForeground}
          keyboardType="numeric"
          value={minStock}
          onChangeText={setMinStock}
        />
        {canViewCosts && (
          <>
            <Text style={[styles.label, { color: theme.mutedForeground }]}>Unit cost</Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
              placeholder="Unit cost"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="numeric"
              value={unitCost}
              onChangeText={setUnitCost}
            />
            <Text style={[styles.label, { color: theme.mutedForeground }]}>Unit price</Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
              placeholder="Unit price"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="numeric"
              value={unitPrice}
              onChangeText={setUnitPrice}
            />
          </>
        )}
        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
        <Pressable style={[styles.submit, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={submitting}>
          <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
            {submitting ? "Saving..." : "Save changes"}
          </Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  padded: { padding: 16, flex: 1 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  submit: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 6 },
  submitText: { fontWeight: "700" },
});
