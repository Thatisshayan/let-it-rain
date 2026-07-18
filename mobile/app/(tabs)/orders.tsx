import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchOrders, type Order } from "../../src/api/orders";
import { useAuth } from "../../src/api/AuthContext";
import { canManageOrders, hasPermission } from "../../src/lib/permissions";
import { useTheme } from "../../src/theme";
import {
  EmptyMessage,
  ListRow,
  ScreenHeader,
  StatTile,
  StatusMessage,
  Surface,
} from "../../src/ui/command";

const STATUS_LABEL = {
  PENDING: "Pending",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
} as const;

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

  const visibleOrders = orders ?? [];
  const pendingCount = visibleOrders.filter((order) => order.status === "PENDING").length;
  const enRouteCount = visibleOrders.filter((order) => order.status === "OUT_FOR_DELIVERY").length;
  const deliveredCount = visibleOrders.filter((order) => order.status === "DELIVERED").length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <ScreenHeader
          theme={theme}
          eyebrow="Dispatch board"
          title={canManage ? "Assignment, movement, and completion pressure in one lane." : "Your assigned delivery lane at a glance."}
          description={canManage ? "All orders" : "Assigned to you"}
          right={
            canCreateOrders ? (
              <Pressable style={[styles.newButton, { backgroundColor: theme.primary }]} onPress={() => router.push("/orders/new")} accessibilityRole="button" accessibilityLabel="Create new order">
                <Text style={[styles.newButtonText, { color: theme.primaryForeground }]}>+ New</Text>
              </Pressable>
            ) : undefined
          }
        />

        <View style={styles.metricGrid}>
          <StatTile theme={theme} label="Visible orders" value={String(visibleOrders.length).padStart(2, "0")} hint={canManage ? "Dispatch queue scope" : "Driver queue scope"} />
          <StatTile theme={theme} label="Pending" value={String(pendingCount).padStart(2, "0")} hint="Awaiting action" />
          <StatTile theme={theme} label="En route" value={String(enRouteCount).padStart(2, "0")} hint="Out in the field" tone={enRouteCount > 0 ? "warning" : "default"} />
          <StatTile theme={theme} label="Delivered" value={String(deliveredCount).padStart(2, "0")} hint="Completed flow" tone={deliveredCount > 0 ? "success" : "default"} />
        </View>

        {error ? (
          <Surface theme={theme}>
            <StatusMessage theme={theme} title="Could not load orders." detail="Pull to refresh or retry once connectivity is back." onRetry={() => refetch()} retryLabel="Retry loading orders" />
          </Surface>
        ) : null}

        {isLoading ? (
          <Surface theme={theme}>
            <Text style={[styles.loading, { color: theme.mutedForeground }]}>Loading dispatch queue…</Text>
          </Surface>
        ) : null}

        <FlatList
          data={visibleOrders}
          keyExtractor={(o: Order) => o.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
          ListEmptyComponent={
            !isLoading ? (
              <Surface theme={theme}>
                <EmptyMessage
                  theme={theme}
                  title={canManage ? "No orders yet." : "No orders assigned to you yet."}
                  detail={canManage ? "New customer orders will appear here as they are created." : "Orders assigned to you will appear here as soon as dispatch routes them."}
                />
              </Surface>
            ) : null
          }
          renderItem={({ item }) => (
            <ListRow
              theme={theme}
              title={item.customerName}
              detail={`${item.lineItems.length} item${item.lineItems.length === 1 ? "" : "s"}${item.driver ? ` · ${item.driver.name}` : ""}`}
              meta={STATUS_LABEL[item.status]}
              tone={
                item.status === "DELIVERED"
                  ? "success"
                  : item.status === "OUT_FOR_DELIVERY"
                    ? "warning"
                    : item.status === "CANCELLED"
                      ? "destructive"
                      : "default"
              }
              onPress={() => router.push(`/orders/${item.id}`)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 16, paddingBottom: 32 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  loading: { fontSize: 14, fontWeight: "600" },
  listContent: { gap: 10, paddingBottom: 24 },
  newButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  newButtonText: { fontWeight: "600" },
  retryButton: { marginTop: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  retryText: { fontSize: 14, fontWeight: "700" },
});
