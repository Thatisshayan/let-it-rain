import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchReports, formatMoney } from "../../src/api/reports";
import { fetchItems } from "../../src/api/items";
import { fetchActivity } from "../../src/api/activity";
import { useTheme } from "../../src/theme";

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const reports = useQuery({ queryKey: ["reports", undefined], queryFn: () => fetchReports() });
  const lowStock = useQuery({ queryKey: ["items", "", true], queryFn: () => fetchItems({ low: true }) });
  const activity = useQuery({ queryKey: ["activity", undefined], queryFn: () => fetchActivity() });

  const isRefetching = reports.isRefetching || lowStock.isRefetching || activity.isRefetching;
  async function onRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);
  }

  const recentMovements = (activity.data?.movements ?? []).slice(0, 5);

  return (
    <FlatList
      style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.primary} />}
      ListHeaderComponent={
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.foreground }]}>Dashboard</Text>

          <View style={styles.cardsRow}>
            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Text style={[styles.cardLabel, { color: theme.mutedForeground }]}>Today&apos;s revenue</Text>
              <Text style={[styles.cardValue, { color: theme.foreground }]}>
                {reports.data ? formatMoney(reports.data.todayRevenue) : "—"}
              </Text>
            </View>
            <Pressable
              style={[
                styles.card,
                { borderColor: theme.border, backgroundColor: theme.card },
                (lowStock.data?.length ?? 0) > 0 && {
                  borderColor: theme.warning,
                  backgroundColor: theme.warningBackground,
                },
              ]}
              onPress={() => router.push("/items?low=1")}
            >
              <Text style={[styles.cardLabel, { color: theme.mutedForeground }]}>Low stock</Text>
              <Text style={[styles.cardValue, { color: theme.foreground }]}>{lowStock.data?.length ?? "—"}</Text>
            </Pressable>
          </View>

          {(lowStock.data?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Needs restocking</Text>
              {lowStock.data!.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.row, { borderColor: theme.border }]}
                  onPress={() => router.push(`/items/${item.id}`)}
                >
                  <Text style={[styles.rowName, { color: theme.foreground }]}>{item.name}</Text>
                  <Text style={[styles.lowStockText, { color: theme.destructive }]}>
                    {item.quantity} / {item.minStock} min
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Recent activity</Text>
            {recentMovements.length === 0 ? (
              <Text style={[styles.empty, { color: theme.mutedForeground }]}>No recent stock movements.</Text>
            ) : (
              recentMovements.map((m) => (
                <View key={m.id} style={[styles.row, { borderColor: theme.border }]}>
                  <Text style={[styles.rowName, { color: theme.foreground }]}>
                    {m.itemName} — {m.type} ({m.delta > 0 ? "+" : ""}
                    {m.delta})
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.mutedForeground }]}>{m.userName}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  cardsRow: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12 },
  cardLabel: { fontSize: 11 },
  cardValue: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  section: { marginTop: 8, gap: 4 },
  sectionTitle: { fontWeight: "600" },
  empty: { fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowName: { fontWeight: "500", flexShrink: 1 },
  rowMeta: { fontSize: 11 },
  lowStockText: { fontWeight: "600" },
});
