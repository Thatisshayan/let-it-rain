import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchReports, formatMoney } from "../../src/api/reports";
import { adjacentMonthParam } from "../../src/api/activity";
import { useTheme } from "../../src/theme";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [month, setMonth] = useState<string | undefined>(undefined);

  const canViewReports = hasPermission(session, "VIEW_REPORTS");

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["reports", month],
    queryFn: () => fetchReports(month),
    enabled: canViewReports,
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (!canViewReports) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
        <Text style={[styles.padded, { color: theme.destructive }]}>
          You don&apos;t have permission to view reports.
        </Text>
      </View>
    );
  }

  if (isLoading || !data)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (error)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load reports.
      </Text>
    );

  const cards: { label: string; value: string; negative?: boolean }[] = [
    { label: "Today's revenue", value: formatMoney(data.todayRevenue) },
    { label: `${data.monthLabel} revenue`, value: formatMoney(data.monthRevenue) },
    { label: "Cash this month", value: formatMoney(data.monthCash) },
    { label: "Interac this month", value: formatMoney(data.monthInterac) },
    { label: "Cost of goods sold", value: formatMoney(data.monthCogs) },
    { label: "Gross profit", value: formatMoney(data.monthProfit), negative: data.monthProfit < 0 },
    { label: "Restock cost", value: formatMoney(data.monthRestockCost) },
    { label: "Inventory valuation", value: formatMoney(data.inventoryValuation) },
  ];

  const maxRevenue = Math.max(...data.revenueByDay.map((d) => d.revenue), 0.01);

  return (
    <FlatList
      style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      onRefresh={refetch}
      refreshing={isRefetching}
      ListHeaderComponent={
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={() => goToMonth(-1)}>
              <Text style={{ color: theme.primary }}>← Prev</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: theme.foreground }]}>{data.monthLabel}</Text>
            <Pressable onPress={() => goToMonth(1)}>
              <Text style={{ color: theme.primary }}>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.cardsGrid}>
            {cards.map((c) => (
              <View key={c.label} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Text style={[styles.cardLabel, { color: theme.mutedForeground }]}>{c.label}</Text>
                <Text style={[styles.cardValue, { color: c.negative ? theme.destructive : theme.foreground }]}>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Revenue by day</Text>
          {data.revenueByDay.length === 0 ? (
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>No sales recorded this month.</Text>
          ) : (
            data.revenueByDay.map((d) => (
              <View key={d.date} style={styles.chartRow}>
                <Text style={[styles.chartLabel, { color: theme.mutedForeground }]}>{d.date.slice(5)}</Text>
                <View style={[styles.chartTrack, { backgroundColor: theme.muted }]}>
                  <View
                    style={[
                      styles.chartBar,
                      { width: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.chartValue, { color: theme.foreground }]}>{formatMoney(d.revenue)}</Text>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Sales by item</Text>
          {data.salesByItem.length === 0 ? (
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>No sales recorded this month.</Text>
          ) : (
            data.salesByItem.map((row) => (
              <View key={row.itemId} style={[styles.row, { borderColor: theme.border }]}>
                <View>
                  <Text style={[styles.rowName, { color: theme.foreground }]}>{row.itemName}</Text>
                  <Text style={[styles.rowMeta, { color: theme.mutedForeground }]}>{row.unitsSold} units sold</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowValue, { color: theme.foreground }]}>{formatMoney(row.revenue)}</Text>
                  <Text style={[styles.rowMeta, { color: theme.mutedForeground }]}>profit {formatMoney(row.profit)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  padded: { padding: 16, flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  card: { flexBasis: "47%", borderWidth: 1, borderRadius: 8, padding: 12 },
  cardLabel: { fontSize: 11 },
  cardValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  sectionTitle: { fontWeight: "600", marginTop: 16 },
  empty: { fontSize: 13 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  chartLabel: { width: 48, fontSize: 11 },
  chartTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  chartBar: { height: "100%", borderRadius: 4 },
  chartValue: { width: 64, textAlign: "right", fontSize: 11, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowName: { fontWeight: "500" },
  rowMeta: { fontSize: 11 },
  rowValue: { fontWeight: "600" },
  rowRight: { alignItems: "flex-end" },
});
