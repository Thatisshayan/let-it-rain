import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItems } from "../../src/api/items";
import { createOrder } from "../../src/api/orders";
import { ApiError } from "../../src/api/client";
import { useTheme } from "../../src/theme";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";
import { ScreenHeader, Surface } from "../../src/ui/command";

type Row = { id: number; itemId: string; quantity: string };
let rowKey = 0;

export default function NewOrderScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user: session } = useAuth();
  const canCreateOrders = hasPermission(session, "CREATE_ORDERS");

  const { data: items } = useQuery({ queryKey: ["items", "", false], queryFn: () => fetchItems() });

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([{ id: rowKey++, itemId: "", quantity: "1" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!canCreateOrders) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to create orders.</Text>
      </View>
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { id: rowKey++, itemId: "", quantity: "1" }]);
  }
  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }
  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function onSubmit() {
    setError(null);
    const lineItems = rows
      .filter((r) => r.itemId)
      .map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity) || 0 }));
    if (lineItems.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setSubmitting(true);
    try {
      const { orderId } = await createOrder({
        customerName,
        customerAddress: customerAddress || undefined,
        customerPhone: customerPhone || undefined,
        notes: notes || undefined,
        lineItems,
      });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.replace(`/orders/${orderId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create order.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <ScreenHeader
        theme={theme}
        eyebrow="New order"
        title="Build a delivery ticket without friction."
        description="Capture the customer, compose the line items, and dispatch the order from one polished flow."
      />
      <Surface theme={theme}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Customer name</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Customer name"
          placeholderTextColor={theme.mutedForeground}
          value={customerName}
          onChangeText={setCustomerName}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Delivery address</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Delivery address (optional)"
          placeholderTextColor={theme.mutedForeground}
          value={customerAddress}
          onChangeText={setCustomerAddress}
        />
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Phone</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Phone (optional)"
          placeholderTextColor={theme.mutedForeground}
          value={customerPhone}
          onChangeText={setCustomerPhone}
        />

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Items</Text>
        {rows.map((row, rowIndex) => (
          <View key={row.id} style={styles.itemRow}>
            <View style={[styles.picker, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
              {(items ?? []).map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.pickerOption, row.itemId === item.id && { backgroundColor: theme.primary + "26" }]}
                  onPress={() => updateRow(row.id, { itemId: item.id })}
                >
                  <Text
                    style={{
                      color: row.itemId === item.id ? theme.primary : theme.foreground,
                      fontWeight: row.itemId === item.id ? "700" : "500",
                    }}
                  >
                    {item.name} ({item.quantity} in stock)
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowFooter}>
              <TextInput
                style={[...inputStyle, styles.qtyInput, { backgroundColor: theme.surfaceStrong }]}
                placeholder="Qty"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                value={row.quantity}
                onChangeText={(v) => updateRow(row.id, { quantity: v })}
              />
              <Pressable
                onPress={() => removeRow(row.id)}
                disabled={rows.length === 1}
                style={[styles.removeButton, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
              >
                <Text style={{ color: theme.foreground }}>Remove</Text>
              </Pressable>
            </View>
            <Text style={[styles.rowLabel, { color: theme.mutedForeground }]}>Line {rowIndex + 1}</Text>
          </View>
        ))}
        <Pressable onPress={addRow} style={[styles.addRowButton, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]} accessibilityRole="button" accessibilityLabel="Add order item">
          <Text style={{ color: theme.foreground }}>+ Add item</Text>
        </Pressable>

        <Text style={[styles.label, { color: theme.mutedForeground }]}>Notes</Text>
        <TextInput
          style={[...inputStyle, styles.notesInput, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Notes (optional)"
          placeholderTextColor={theme.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
        <Pressable
          style={[styles.submit, { backgroundColor: theme.primary }]}
          onPress={() => {
            if (!customerName.trim()) {
              Alert.alert("Customer name required");
              return;
            }
            onSubmit();
          }}
          disabled={submitting}
        >
          <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
            {submitting ? "Creating..." : "Create order"}
          </Text>
        </Pressable>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  sectionTitle: { fontWeight: "700", fontSize: 18, marginTop: 8, marginBottom: 10 },
  itemRow: { gap: 8, marginBottom: 12 },
  picker: { borderWidth: 1, borderRadius: 20, maxHeight: 180, overflow: "hidden" },
  pickerOption: { padding: 12, borderBottomWidth: 1, borderColor: "transparent" },
  rowFooter: { flexDirection: "row", gap: 8, alignItems: "center" },
  qtyInput: { flex: 1 },
  removeButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
  rowLabel: { fontSize: 12 },
  addRowButton: { padding: 14, borderRadius: 18, borderWidth: 1, alignItems: "center" },
  notesInput: { minHeight: 72, textAlignVertical: "top" },
  submit: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 8 },
  submitText: { fontWeight: "700" },
});
