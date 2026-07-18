import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { createItem } from "../../src/api/items";
import { ApiError } from "../../src/api/client";
import { useTheme } from "../../src/theme";
import { useToast } from "../../src/toast";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";
import { ScreenHeader, Surface } from "../../src/ui/command";

export default function NewItemScreen() {
  const theme = useTheme();
  const { user: session } = useAuth();
  const toast = useToast();
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [location, setLocation] = useState("");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const canEditItems = hasPermission(session, "EDIT_ITEMS");
  const canViewCosts = hasPermission(session, "VIEW_COSTS");

  if (!canEditItems) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to create items.</Text>
      </View>
    );
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { itemId } = await createItem({
        name,
        minStock: Number(minStock) || 0,
        initialQuantity: Number(initialQuantity) || 0,
        location: location.trim() || undefined,
        unitCost: canViewCosts ? Number(unitCost) || 0 : 0,
        unitPrice: canViewCosts ? Number(unitPrice) || 0 : 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Item created");
      router.replace(`/items/${itemId}`);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : "Could not create item.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="New item"
        title="Add inventory with a cleaner setup flow."
        description="Create the stock record, opening quantity, and optional cost metadata in one step."
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
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Opening quantity</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Initial quantity"
          placeholderTextColor={theme.mutedForeground}
          keyboardType="numeric"
          value={initialQuantity}
          onChangeText={setInitialQuantity}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Location</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Location (optional, e.g. Shelf A-3)"
          placeholderTextColor={theme.mutedForeground}
          value={location}
          onChangeText={setLocation}
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
        <Pressable style={[styles.submit, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={submitting} accessibilityRole="button" accessibilityLabel="Create item" accessibilityState={{ disabled: submitting }}>
          <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
            {submitting ? "Saving..." : "Create item"}
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
  submit: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 6 },
  submitText: { fontWeight: "700" },
});
