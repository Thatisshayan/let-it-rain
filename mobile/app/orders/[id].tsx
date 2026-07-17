import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  fetchOrder,
  fetchDrivers,
  assignDriver,
  markOutForDelivery,
  markDelivered,
  cancelOrder,
  type OrderStatus,
} from "../../src/api/orders";
import { ApiError } from "../../src/api/client";
import { enqueueOrderAction } from "../../src/offlineQueue";
import { useAuth } from "../../src/api/AuthContext";
import { canManageOrders, hasPermission } from "../../src/lib/permissions";
import { useTheme } from "../../src/theme";
import { useToast } from "../../src/toast";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function OrderDetailScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canManageOrders(user);
  const canAssignDrivers = hasPermission(user, "ASSIGN_DRIVERS");
  const canCancelOrders = hasPermission(user, "CANCEL_ORDERS");

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id),
  });
  const { data: drivers } = useQuery({
    queryKey: ["orderDrivers"],
    queryFn: fetchDrivers,
    enabled: canAssignDrivers,
  });

  const [payments, setPayments] = useState<Record<string, { cash: string; interac: string }>>({});
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (error || !order)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load this order.
      </Text>
    );

  const isAssignedDriver = order.driver?.id === user?.id;
  const canAct = canManage || isAssignedDriver;
  const isActive = order.status === "PENDING" || order.status === "OUT_FOR_DELIVERY";

  async function invalidateAll() {
    await queryClient.invalidateQueries({ queryKey: ["order", id] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    await queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  async function onAssignDriver(driverId: string | null) {
    setBusy(true);
    try {
      await assignDriver(id, driverId);
      await invalidateAll();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Could not assign driver.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onOutForDelivery() {
    setBusy(true);
    try {
      await markOutForDelivery(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Marked out for delivery");
      await invalidateAll();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        await enqueueOrderAction({ orderId: id, type: "out_for_delivery" });
        toast.show("You're offline — this will sync automatically once you're back online.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show(err instanceof ApiError ? err.message : "Could not update order.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDeliver() {
    if (!order) return;
    setBusy(true);
    const payload = order.lineItems.map((li) => ({
      lineItemId: li.id,
      cashAmount: Number(payments[li.id]?.cash) || 0,
      interacAmount: Number(payments[li.id]?.interac) || 0,
    }));
    try {
      await markDelivered(id, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Delivery confirmed");
      await invalidateAll();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        await enqueueOrderAction({ orderId: id, type: "deliver", payments: payload });
        toast.show("You're offline — this will sync automatically once you're back online.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show(err instanceof ApiError ? err.message : "Could not confirm delivery.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    setBusy(true);
    try {
      await cancelOrder(id);
      toast.show("Order cancelled");
      await invalidateAll();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Could not cancel order.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: theme.foreground }]}>{order.customerName}</Text>
      {order.customerAddress ? <Text style={{ color: theme.mutedForeground }}>{order.customerAddress}</Text> : null}
      {order.customerPhone ? <Text style={{ color: theme.mutedForeground }}>{order.customerPhone}</Text> : null}
      <Text style={{ color: theme.primary, fontWeight: "600" }}>{STATUS_LABEL[order.status]}</Text>

      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Items</Text>
      {order.lineItems.map((li) => (
        <View key={li.id} style={[styles.itemRow, { borderColor: theme.border }]}>
          <Text style={{ color: theme.foreground }}>{li.itemName}</Text>
          <Text style={{ color: theme.mutedForeground }}>× {li.quantity}</Text>
        </View>
      ))}

      {canAssignDrivers && isActive && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Driver</Text>
          <View style={styles.driverRow}>
            {(drivers ?? []).map((d) => (
              <Pressable
                key={d.id}
                style={[
                  styles.chip,
                  { borderColor: theme.border },
                  order.driver?.id === d.id && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => onAssignDriver(d.id)}
                disabled={busy}
              >
                <Text style={{ color: order.driver?.id === d.id ? theme.primaryForeground : theme.foreground }}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {!canAssignDrivers && order.driver && (
        <Text style={{ color: theme.mutedForeground }}>Assigned to {order.driver.name}</Text>
      )}

      {canAct && order.status === "PENDING" && (
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={onOutForDelivery} disabled={busy}>
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Mark out for delivery</Text>
        </Pressable>
      )}

      {canAct && isActive && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Mark delivered</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
            Enter what the customer paid per item, if anything.
          </Text>
          {order.lineItems.map((li) => (
            <View key={li.id} style={styles.paymentRow}>
              <Text style={{ color: theme.foreground, flexBasis: "100%" }}>{li.itemName}</Text>
              <TextInput
                style={[styles.input, styles.paymentInput, { borderColor: theme.border, color: theme.foreground }]}
                placeholder="Cash"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                value={payments[li.id]?.cash ?? ""}
                onChangeText={(v) =>
                  setPayments((prev) => ({ ...prev, [li.id]: { cash: v, interac: prev[li.id]?.interac ?? "" } }))
                }
              />
              <TextInput
                style={[styles.input, styles.paymentInput, { borderColor: theme.border, color: theme.foreground }]}
                placeholder="Interac"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="decimal-pad"
                value={payments[li.id]?.interac ?? ""}
                onChangeText={(v) =>
                  setPayments((prev) => ({ ...prev, [li.id]: { cash: prev[li.id]?.cash ?? "", interac: v } }))
                }
              />
            </View>
          ))}
          <Pressable style={[styles.button, { backgroundColor: theme.success }]} onPress={onDeliver} disabled={busy}>
            <Text style={styles.buttonText}>Confirm delivered</Text>
          </Pressable>
        </>
      )}

      {canCancelOrders && isActive && (
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border }]} onPress={onCancel} disabled={busy}>
          <Text style={{ color: theme.destructive }}>Cancel order</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  padded: { padding: 16, flex: 1 },
  title: { fontSize: 22, fontWeight: "700" },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  driverRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  paymentInput: { flex: 1 },
  button: { padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { fontWeight: "600", color: "#fff" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, alignItems: "center", marginTop: 8 },
});
