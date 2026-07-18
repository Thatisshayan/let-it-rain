import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchReports, formatMoney } from "../../src/api/reports";
import { adjacentMonthParam } from "../../src/api/activity";
import { useTheme } from "../../src/theme";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";
import {
  EmptyMessage,
  ListRow,
  ScreenHeader,
  StatTile,
  Surface,
} from "../../src/ui/command";

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user: session } = useAuth();
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
        <Text style={[styles.padded, { color: theme.destructive }]}>You don't have permission to view reports.</Text>
      </View>
    );
  }

  if (isLoading || !data) {
    return (
      <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>
        Loading...
      </Text>
    );
  }

  if (error) {
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load reports.
      </Text>
    );
  }

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
      contentContainerStyle={styles.content}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      onRefresh={refetch}
      refreshing={isRefetching}
      ListHeaderComponent={
        <>
          <ScreenHeader
            theme={theme}
            eyebrow="Accounting snapshot"
            title="Revenue, margin, and stock value without leaving the field view."
            description={`Operating economics for ${data.monthLabel}.`}
          />

          <Surface theme={theme}>
            <View style={styles.header}>
              <Pressable onPress={() => goToMonth(-1)}>
                <Text style={{ color: theme.primary }}>← Prev</Text>
              </Pressable>
              <Text style={[styles.monthLabel, { color: theme.foreground }]}>{data.monthLabel}</Text>
              <Pressable onPress={() => goToMonth(1)}>
                <Text style={{ color: theme.primary }}>Next →</Text>
              </Pressable>
            </View>
            <View style={styles.metricGrid}>
              {cards.slice(0, 4).map((card) => (
                <StatTile
                  key={card.label}
                  theme={theme}
                  label={card.label}
                  value={card.value}
                  tone={card.negative ? "warning" : "default"}
                />
              ))}
            </View>
          </Surface>

          <Surface theme={theme}>
            <View style={styles.metricGrid}>
              {cards.slice(4).map((card) => (
                <StatTile
                  key={card.label}
                  theme={theme}
                  label={card.label}
                  value={card.value}
                  tone={card.negative ? "warning" : card.label === "Gross profit" ? "success" : "default"}
                />
              ))}
            </View>
          </Surface>

          <Surface theme={theme}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Revenue by day</Text>
            {data.revenueByDay.length === 0 ? (
              <EmptyMessage theme={theme} title="No sales recorded this month." detail="Revenue bars will appear once sales are logged." />
            ) : (
              <View style={styles.chartList}>
                {data.revenueByDay.map((d) => (
                  <View key={d.date} style={styles.chartRow}>
                    <Text style={[styles.chartLabel, { color: theme.mutedForeground }]}>{d.date.slice(5)}</Text>
                    <View style={[styles.chartTrack, { backgroundColor: theme.muted }]}>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            width: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%`,
                            backgroundColor: theme.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.chartValue, { color: theme.foreground }]}>{formatMoney(d.revenue)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>

          <Surface theme={theme}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Sales by item</Text>
            {data.salesByItem.length === 0 ? (
              <EmptyMessage theme={theme} title="No sales recorded this month." detail="Item-level performance appears here once sales are logged." />
            ) : (
              <View style={styles.rowStack}>
                {data.salesByItem.map((row) => (
                  <View key={row.itemId} style={styles.salesRow}>
                    <ListRow
                      theme={theme}
                      title={row.itemName}
                      detail={`${row.unitsSold} units sold`}
                      meta={formatMoney(row.revenue)}
                    />
                    <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                      {row.unitsSold} units sold
                    </Text>
                    <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>
                      profit {formatMoney(row.profit)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  padded: { padding: 16, flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  monthLabel: { fontWeight: "700", fontSize: 15 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 14 },
  chartList: { gap: 10 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartLabel: { width: 48, fontSize: 11, fontWeight: "600" },
  chartTrack: { flex: 1, height: 10, borderRadius: 999, overflow: "hidden" },
  chartBar: { height: "100%", borderRadius: 999 },
  chartValue: { width: 72, textAlign: "right", fontSize: 11, fontWeight: "700" },
  rowStack: { gap: 10 },
  salesRow: { gap: 6 },
});
