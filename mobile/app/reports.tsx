import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchReports, formatMoney } from "../src/api/reports";
import { adjacentMonthParam } from "../src/api/activity";

export default function ReportsScreen() {
  const [month, setMonth] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", month],
    queryFn: () => fetchReports(month),
    staleTime: 30_000,
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (isLoading || !data) return <Text style={styles.padded}>Loading...</Text>;
  if (error) return <Text style={[styles.padded, styles.error]}>Could not load reports.</Text>;

  const cards: { label: string; value: string; negative?: boolean }[] = [
    { label: "Today's revenue", value: formatMoney(data.todayRevenue) },
    { label: `${data.monthLabel} revenue`, value: formatMoney(data.monthRevenue) },
    { label: "Cost of goods sold", value: formatMoney(data.monthCogs) },
    { label: "Gross profit", value: formatMoney(data.monthProfit), negative: data.monthProfit < 0 },
    { label: "Restock cost", value: formatMoney(data.monthRestockCost) },
    { label: "Inventory valuation", value: formatMoney(data.inventoryValuation) },
  ];

  return (
    <FlatList
      style={styles.container}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      ListHeaderComponent={
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={() => goToMonth(-1)}>
              <Text>← Prev</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{data.monthLabel}</Text>
            <Pressable onPress={() => goToMonth(1)}>
              <Text>Next →</Text>
            </Pressable>
          </View>

          <View style={styles.cardsGrid}>
            {cards.map((c) => (
              <View key={c.label} style={styles.card}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={[styles.cardValue, c.negative && styles.negative]}>{c.value}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Revenue by day</Text>
          {data.revenueByDay.length === 0 ? (
            <Text style={styles.empty}>No sales recorded this month.</Text>
          ) : (
            data.revenueByDay.map((d) => (
              <View key={d.date} style={styles.row}>
                <Text>{d.date}</Text>
                <Text style={styles.rowValue}>{formatMoney(d.revenue)}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Sales by item</Text>
          {data.salesByItem.length === 0 ? (
            <Text style={styles.empty}>No sales recorded this month.</Text>
          ) : (
            data.salesByItem.map((row) => (
              <View key={row.itemId} style={styles.row}>
                <View>
                  <Text style={styles.rowName}>{row.itemName}</Text>
                  <Text style={styles.rowMeta}>{row.unitsSold} units sold</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{formatMoney(row.revenue)}</Text>
                  <Text style={styles.rowMeta}>profit {formatMoney(row.profit)}</Text>
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
  padded: { padding: 16 },
  error: { color: "#c00" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  card: { flexBasis: "47%", borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 12 },
  cardLabel: { fontSize: 11, color: "#666" },
  cardValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  negative: { color: "#c00" },
  sectionTitle: { fontWeight: "600", marginTop: 16 },
  empty: { color: "#666", fontSize: 13 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  rowName: { fontWeight: "500" },
  rowMeta: { fontSize: 11, color: "#666" },
  rowValue: { fontWeight: "600" },
  rowRight: { alignItems: "flex-end" },
});
