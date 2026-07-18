import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { adjustStock } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";
import { useAuth } from "../../../src/api/AuthContext";
import { hasPermission } from "../../../src/lib/permissions";
import { useTheme } from "../../../src/theme";
import { useToast } from "../../../src/toast";
import { ScreenHeader, Surface } from "../../../src/ui/command";

const TYPES = ["RECEIVE", "REMOVE", "ADJUST"] as const;

export default function AdjustStockScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { user: session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [type, setType] = useState<(typeof TYPES)[number]>("RECEIVE");
  const [amount, setAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [interacAmount, setInteracAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const canAdjustStock = hasPermission(session, "ADJUST_STOCK");

  const total = (Number(cashAmount) || 0) + (Number(interacAmount) || 0);

  if (!canAdjustStock) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to adjust stock.</Text>
      </View>
    );
  }

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
      } else if (type === "REMOVE") {
        await adjustStock(id, {
          type: "REMOVE",
          amount: numeric,
          cashAmount: Number(cashAmount) || 0,
          interacAmount: Number(interacAmount) || 0,
          reason: reason || undefined,
        });
      } else {
        await adjustStock(id, { type, amount: numeric, reason: reason || undefined });
      }
      await queryClient.invalidateQueries({ queryKey: ["item", id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Stock adjusted");
      router.back();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="Stock movement"
        title="Update inventory with audit-ready detail."
        description="Switch between receiving, removing, or reconciling stock counts without breaking the flow."
      />
      <Surface theme={theme}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Movement type</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t}
              style={[
                styles.typeButton,
                { borderColor: theme.border, backgroundColor: theme.surfaceStrong },
                type === t && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeButtonText, { color: type === t ? theme.primaryForeground : theme.foreground }]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>
          {type === "ADJUST" ? "Counted quantity" : "Amount"}
        </Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder={type === "ADJUST" ? "Counted quantity" : "Amount"}
          placeholderTextColor={theme.mutedForeground}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        {type === "REMOVE" && (
          <View style={styles.paymentBox}>
            <Text style={[styles.label, { color: theme.mutedForeground }]}>Sale capture</Text>
            <View style={styles.paymentRow}>
              <TextInput
                style={[...inputStyle, styles.paymentInput, { backgroundColor: theme.surfaceStrong }]}
                placeholder="Cash received"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                value={cashAmount}
                onChangeText={setCashAmount}
              />
              <TextInput
                style={[...inputStyle, styles.paymentInput, { backgroundColor: theme.surfaceStrong }]}
                placeholder="Interac received"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                value={interacAmount}
                onChangeText={setInteracAmount}
              />
            </View>
            <Text style={[styles.paymentTotal, { color: theme.mutedForeground }]}>
              Total: ${total.toFixed(2)}
              {total === 0 && " — leave blank for a non-sale removal"}
            </Text>
          </View>
        )}
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Reason</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          placeholder="Reason (optional)"
          placeholderTextColor={theme.mutedForeground}
          value={reason}
          onChangeText={setReason}
        />
        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
        <Pressable style={[styles.submit, { backgroundColor: theme.primary }]} onPress={onSubmit} disabled={submitting}>
          <Text style={[styles.submitText, { color: theme.primaryForeground }]}>
            {submitting ? "Saving..." : "Save"}
          </Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, flex: 1, alignItems: "center" },
  typeButtonText: { fontWeight: "700", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  paymentBox: { gap: 8, marginTop: 4 },
  paymentRow: { flexDirection: "row", gap: 8 },
  paymentInput: { flex: 1 },
  paymentTotal: { fontSize: 12 },
  submit: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 6 },
  submitText: { fontWeight: "700" },
});
