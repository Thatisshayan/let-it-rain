import { useMemo, useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchItems, type Item } from "../../src/api/items";
import { exportItemsCsv } from "../../src/api/export";
import { useTheme } from "../../src/theme";

const SORTS = ["name", "quantity", "value"] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = { name: "Name", quantity: "Quantity", value: "Value" };

export default function ItemsScreen() {
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [exporting, setExporting] = useState(false);
  const insets = useSafeAreaInsets();
  const { data: items, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["items", q, lowOnly],
    queryFn: () => fetchItems({ q, low: lowOnly }),
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items ?? []) {
      if (item.category) set.add(item.category);
    }
    return [...set].sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    let list = items ?? [];
    if (category) list = list.filter((i) => i.category === category);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "quantity") sorted.sort((a, b) => b.quantity - a.quantity);
    else sorted.sort((a, b) => b.quantity * b.unitCost - a.quantity * a.unitCost);
    return sorted;
  }, [items, category, sort]);

  async function onExport() {
    setExporting(true);
    try {
      await exportItemsCsv();
    } catch (err) {
      Alert.alert("Export failed", err instanceof Error ? err.message : "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}>
      <View style={styles.topRow}>
        <TextInput
          style={[styles.search, styles.searchFlex, { borderColor: theme.border, color: theme.foreground }]}
          placeholder="Search items"
          placeholderTextColor={theme.mutedForeground}
          value={q}
          onChangeText={setQ}
        />
        <Pressable onPress={onExport} style={[styles.exportButton, { borderColor: theme.border }]} disabled={exporting}>
          <Text style={[styles.exportButtonText, { color: theme.foreground }]}>{exporting ? "…" : "Export"}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setLowOnly((v) => !v)} style={styles.filterButton}>
        <Text style={{ color: theme.foreground }}>{lowOnly ? "Showing low stock only" : "Show all"}</Text>
      </Pressable>

      {categories.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...categories]}
          keyExtractor={(c) => c ?? "__all__"}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item: c }) => (
            <Pressable
              style={[
                styles.chip,
                { borderColor: theme.border },
                category === c && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, { color: category === c ? theme.primaryForeground : theme.foreground }]}>
                {c ?? "All"}
              </Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <Pressable
            key={s}
            style={[
              styles.sortButton,
              { backgroundColor: theme.muted },
              sort === s && { backgroundColor: theme.primary + "26" },
            ]}
            onPress={() => setSort(s)}
          >
            <Text style={{ color: sort === s ? theme.primary : theme.foreground, fontWeight: sort === s ? "600" : "400" }}>
              {SORT_LABEL[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? <Text style={{ color: theme.foreground }}>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={[styles.error, { color: theme.destructive }]}>Could not load items.</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={{ color: theme.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={visibleItems}
        keyExtractor={(item: Item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={() => router.push(`/items/${item.id}`)}>
            <Text style={[styles.rowName, { color: theme.foreground }]}>{item.name}</Text>
            <Text style={{ color: item.lowStock ? theme.destructive : theme.foreground, fontWeight: item.lowStock ? "600" : "400" }}>
              {item.quantity} in stock
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => router.push("/items/new")}>
        <Text style={[styles.addButtonText, { color: theme.primaryForeground }]}>+ New item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: "row", gap: 8 },
  search: { borderWidth: 1, borderRadius: 8, padding: 10 },
  searchFlex: { flex: 1 },
  exportButton: { justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  exportButtonText: { fontWeight: "500" },
  filterButton: { padding: 8 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13 },
  sortRow: { flexDirection: "row", gap: 6 },
  sortButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  error: {},
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowName: { fontWeight: "500" },
  addButton: { padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  addButtonText: { fontWeight: "600" },
});
