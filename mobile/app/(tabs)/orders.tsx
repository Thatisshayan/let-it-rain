import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchOrders, type Order, type OrderStatus } from "../../src/api/orders";
import { useAuth } from "../../src/api/AuthContext";
import { canManageOrders, hasPermission } from "../../src/lib/permissions";
import { useTheme } from "../../src/theme";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function OrdersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canManage = canManageOrders(user);
  const canCreateOrders = hasPermission(user, "CREATE_ORDERS");

  const { data: orders, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  function statusColor(status: OrderStatus) {
    if (status === "DELIVERED") return theme.success;
    if (status === "CANCELLED") return theme.destructive;
    if (status === "OUT_FOR_DELIVERY") return theme.warning;
    return theme.mutedForeground;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>Orders</Text>
        {canCreateOrders && (
          <Pressable style={[styles.newButton, { backgroundColor: theme.primary }]} onPress={() => router.push("/orders/new")}>
            <Text style={[styles.newButtonText, { color: theme.primaryForeground }]}>+ New</Text>
          </Pressable>
        )}
      </View>
      <Text style={{ color: theme.mutedForeground, marginBottom: 8 }}>
        {canManage ? "All orders" : "Assigned to you"}
      </Text>

      {isLoading ? <Text style={{ color: theme.foreground }}>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={{ color: theme.destructive }}>Could not load orders.</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={{ color: theme.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={orders ?? []}
        keyExtractor={(o: Order) => o.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={{ color: theme.mutedForeground, marginTop: 16 }}>
              {canManage ? "No orders yet." : "No orders assigned to you yet."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={() => router.push(`/orders/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { color: theme.foreground }]}>{item.customerName}</Text>
              <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                {item.lineItems.length} item{item.lineItems.length === 1 ? "" : "s"}
                {item.driver ? ` · ${item.driver.name}` : ""}
              </Text>
            </View>
            <Text style={{ color: statusColor(item.status), fontWeight: "600", fontSize: 12 }}>
              {STATUS_LABEL[item.status]}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  newButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newButtonText: { fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowName: { fontWeight: "500" },
});
