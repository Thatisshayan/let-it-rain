import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchItem } from "../../../src/api/items";
import { exportItemMovementsCsv } from "../../../src/api/export";
import { useTheme } from "../../../src/theme";

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
      <Text style={[styles.title, { color: theme.foreground }]}>{data.item.name}</Text>
      <Text style={{ color: theme.foreground }}>
        {data.item.quantity} in stock (min {data.item.minStock})
      </Text>
      <View style={styles.actions}>
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => router.push(`/items/${id}/adjust`)}>
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Adjust stock</Text>
        </Pressable>
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border }]} onPress={() => router.push(`/items/${id}/edit`)}>
          <Text style={{ color: theme.foreground }}>Edit item</Text>
        </Pressable>
        <Pressable style={[styles.buttonSecondary, { borderColor: theme.border }]} onPress={onExport} disabled={exporting}>
          <Text style={{ color: theme.foreground }}>{exporting ? "Exporting…" : "Export CSV"}</Text>
        </Pressable>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Movement history</Text>
      <FlatList
        data={data.movements}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        renderItem={({ item: m }) => (
          <View style={[styles.movementRow, { borderColor: theme.border }]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16, flex: 1 },
  title: { fontSize: 22, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginVertical: 12 },
  button: { padding: 12, borderRadius: 8 },
  buttonText: { fontWeight: "600" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1 },
  sectionTitle: { fontWeight: "600", marginTop: 8 },
  movementRow: { paddingVertical: 8, borderBottomWidth: 1 },
  movementMeta: { fontSize: 12 },
  saleMeta: { fontSize: 12, marginTop: 2 },
});
