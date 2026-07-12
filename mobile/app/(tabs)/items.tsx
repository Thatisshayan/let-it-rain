import { useMemo, useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet, RefreshControl, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchItems, type Item } from "../../src/api/items";
import { exportItemsCsv } from "../../src/api/export";

const SORTS = ["name", "quantity", "value"] as const;
type Sort = (typeof SORTS)[number];
const SORT_LABEL: Record<Sort, string> = { name: "Name", quantity: "Quantity", value: "Value" };

export default function ItemsScreen() {
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
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topRow}>
        <TextInput style={[styles.search, styles.searchFlex]} placeholder="Search items" value={q} onChangeText={setQ} />
        <Pressable onPress={onExport} style={styles.exportButton} disabled={exporting}>
          <Text style={styles.exportButtonText}>{exporting ? "…" : "Export"}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => setLowOnly((v) => !v)} style={styles.filterButton}>
        <Text>{lowOnly ? "Showing low stock only" : "Show all"}</Text>
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
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c ?? "All"}</Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <Pressable
            key={s}
            style={[styles.sortButton, sort === s && styles.sortButtonActive]}
            onPress={() => setSort(s)}
          >
            <Text style={sort === s ? styles.sortTextActive : undefined}>{SORT_LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? <Text>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={styles.error}>Could not load items.</Text>
          <Pressable onPress={() => refetch()}>
            <Text>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={visibleItems}
        keyExtractor={(item: Item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/items/${item.id}`)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={item.lowStock ? styles.lowStock : undefined}>{item.quantity} in stock</Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.addButton} onPress={() => router.push("/items/new")}>
        <Text style={styles.addButtonText}>+ New item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: "row", gap: 8 },
  search: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  searchFlex: { flex: 1 },
  exportButton: { justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  exportButtonText: { fontWeight: "500" },
  filterButton: { padding: 8 },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#ccc" },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13 },
  chipTextActive: { color: "#fff" },
  sortRow: { flexDirection: "row", gap: 6 },
  sortButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#f3f4f6" },
  sortButtonActive: { backgroundColor: "#dbeafe" },
  sortTextActive: { fontWeight: "600", color: "#2563eb" },
  error: { color: "#c00" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  rowName: { fontWeight: "500" },
  lowStock: { color: "#c00", fontWeight: "600" },
  addButton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  addButtonText: { color: "#fff", fontWeight: "600" },
});
