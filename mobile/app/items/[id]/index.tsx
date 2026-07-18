import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchItem } from "../../../src/api/items";
import { exportItemMovementsCsv } from "../../../src/api/export";
import { useTheme } from "../../../src/theme";
import { EmptyMessage, ScreenHeader, StatTile, Surface } from "../../../src/ui/command";

export default function ItemDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
  });

  if (isLoading)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (error || !data)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load item.
      </Text>
    );

  async function onExport() {
    if (!data) return;
    setExporting(true);
    try {
      await exportItemMovementsCsv(id, data.item.name);
    } catch (err) {
      Alert.alert("Export failed", err instanceof Error ? err.message : "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="Item ledger"
        title={data.item.name}
        description={`${data.item.quantity} in stock (min ${data.item.minStock})`}
      />
      <View style={styles.metricGrid}>
        <StatTile theme={theme} label="On hand" value={data.item.quantity} hint="Current physical quantity" />
        <StatTile theme={theme} label="Minimum" value={data.item.minStock} hint="Restock threshold" />
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => router.push(`/items/${id}/adjust`)}>
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Adjust stock</Text>
        </Pressable>
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]} onPress={() => router.push(`/items/${id}/edit`)}>
          <Text style={{ color: theme.foreground }}>Edit item</Text>
        </Pressable>
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]} onPress={onExport} disabled={exporting}>
          <Text style={{ color: theme.foreground }}>{exporting ? "Exporting…" : "Export CSV"}</Text>
        </Pressable>
      </View>
      <Surface theme={theme}>
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Movement history</Text>
        {data.movements.length === 0 ? (
          <EmptyMessage theme={theme} title="No movement history yet." detail="Inbound, outbound, and count adjustments will appear here." />
        ) : (
          <FlatList
            data={data.movements}
            keyExtractor={(m) => m.id}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
            contentContainerStyle={styles.movementList}
            renderItem={({ item: m }) => (
              <View style={[styles.movementRow, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
                <Text style={{ color: theme.foreground }}>
                  {m.type} {m.delta > 0 ? "+" : ""}
                  {m.delta} -&gt; {m.quantityAfter}
                </Text>
                <Text style={[styles.movementMeta, { color: theme.mutedForeground }]}>
                  {m.user.name} · {new Date(m.createdAt).toLocaleString()}
                </Text>
                {m.isSale && (m.cashAmount != null || m.interacAmount != null) && (
                  <Text style={[styles.saleMeta, { color: theme.success }]}>
                    Sold for ${((m.cashAmount ?? 0) + (m.interacAmount ?? 0)).toFixed(2)} (${(m.cashAmount ?? 0).toFixed(2)} cash, ${(m.interacAmount ?? 0).toFixed(2)} Interac)
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  padded: { padding: 16, flex: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  button: { padding: 14, borderRadius: 16 },
  buttonText: { fontWeight: "700" },
  buttonSecondary: { padding: 14, borderRadius: 16, borderWidth: 1 },
  sectionTitle: { fontWeight: "700", fontSize: 18, marginBottom: 14 },
  movementList: { gap: 10 },
  movementRow: { padding: 14, borderWidth: 1, borderRadius: 18 },
  movementMeta: { fontSize: 12 },
  saleMeta: { fontSize: 12, marginTop: 2 },
});
