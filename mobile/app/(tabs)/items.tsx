import { useMemo, useRef, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  Pressable,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchItems, type Item } from "../../src/api/items";
import { exportItemsCsv } from "../../src/api/export";
import { useTheme } from "../../src/theme";
import { Skeleton } from "../../src/Skeleton";
import {
  EmptyMessage,
  ListRow,
  ScreenHeader,
  StatTile,
  Surface,
} from "../../src/ui/command";

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

  const swipeRefs = useRef<Map<string, SwipeableMethods>>(new Map());
  const lowStockCount = (visibleItems ?? []).filter((item) => item.lowStock).length;

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
      <FlatList
        data={visibleItems}
        keyExtractor={(item: Item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        ListHeaderComponent={
          <>
            <ScreenHeader
              theme={theme}
              eyebrow="Inventory"
              title="Find pressure early, then move straight into the item ledger."
              description={`${visibleItems.length} visible item${visibleItems.length === 1 ? "" : "s"}${lowOnly ? " in low-stock focus mode" : ""}.`}
            />

            <View style={styles.metricGrid}>
              <StatTile theme={theme} label="Visible items" value={String(visibleItems.length).padStart(2, "0")} hint="Current filtered scope" />
              <StatTile theme={theme} label="Low stock" value={String(lowStockCount).padStart(2, "0")} hint="Attention required" tone={lowStockCount > 0 ? "warning" : "success"} />
            </View>

            <Surface theme={theme}>
              <View style={styles.topRow}>
                <TextInput
                  style={[
                    styles.search,
                    styles.searchFlex,
                    {
                      borderColor: theme.border,
                      color: theme.foreground,
                      backgroundColor: theme.surfaceStrong,
                    },
                  ]}
                  placeholder="Search items"
                  placeholderTextColor={theme.mutedForeground}
                  value={q}
                  onChangeText={setQ}
                  accessibilityLabel="Search items"
                  accessibilityRole="search"
                />
                <Pressable
                  onPress={onExport}
                  style={[styles.exportButton, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
                  disabled={exporting}
                  accessibilityRole="button"
                  accessibilityLabel={exporting ? "Exporting items CSV" : "Export items CSV"}
                >
                  <Text style={[styles.exportButtonText, { color: theme.foreground }]}>{exporting ? "…" : "Export"}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => setLowOnly((v) => !v)}
                style={[styles.filterButton, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
                accessibilityRole="switch"
                accessibilityLabel={lowOnly ? "Showing low stock items only" : "Showing all items"}
                accessibilityState={{ checked: lowOnly }}
              >
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
                        { borderColor: theme.border, backgroundColor: theme.surfaceStrong },
                        category === c && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setCategory(c)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by category: ${c ?? "All items"}${category === c ? ", selected" : ""}`}
                    >
                      <Text style={[styles.chipText, { color: category === c ? theme.primaryForeground : theme.foreground }]}>
                        {c ?? "All"}
                      </Text>
                    </Pressable>
                  )}
                />
              )}

              <View style={styles.sortRow} accessibilityRole="none" accessibilityLabel="Sort items">
                {SORTS.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.sortButton,
                      { backgroundColor: theme.surfaceStrong, borderColor: theme.border },
                      sort === s && { backgroundColor: `${theme.primary}22`, borderColor: theme.primary },
                    ]}
                    onPress={() => setSort(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${SORT_LABEL[s]}${sort === s ? ", selected" : ""}`}
                  >
                    <Text style={{ color: sort === s ? theme.primary : theme.foreground, fontWeight: sort === s ? "700" : "500" }}>
                      {SORT_LABEL[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Surface>

            {isLoading ? (
              <View style={styles.skeletonList}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} style={styles.skeletonRow} />
                ))}
              </View>
            ) : null}

            {error ? (
              <Surface theme={theme}>
                <EmptyMessage theme={theme} title="Could not load items." detail="Retry the fetch or pull to refresh." />
                <Pressable onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading items">
                  <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
                </Pressable>
              </Surface>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <Surface theme={theme}>
              <EmptyMessage theme={theme} title="No items found." detail="Adjust the search, category, or stock filters to widen the view." />
            </Surface>
          ) : null
        }
        renderItem={({ item }) => (
          <Swipeable
            ref={(ref) => {
              if (ref) swipeRefs.current.set(item.id, ref);
              else swipeRefs.current.delete(item.id);
            }}
            renderRightActions={() => (
              <Pressable
                style={[styles.swipeAction, { backgroundColor: theme.primary }]}
                onPress={() => {
                  swipeRefs.current.get(item.id)?.close();
                  router.push(`/items/${item.id}/adjust`);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Adjust stock for ${item.name}`}
              >
                <Text style={[styles.swipeActionText, { color: theme.primaryForeground }]}>Adjust</Text>
              </Pressable>
            )}
          >
            <ListRow
              theme={theme}
              title={item.name}
              detail={`${item.quantity} in stock${item.category ? ` · ${item.category}` : ""}`}
              meta={item.lowStock ? "LOW" : "OK"}
              tone={item.lowStock ? "warning" : "default"}
              accessibilityLabel={`${item.name}, ${item.quantity} in stock${item.lowStock ? ", low stock" : ""}. Tap for details.`}
              onPress={() => router.push(`/items/${item.id}`)}
            />
          </Swipeable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <Pressable
        style={[styles.addButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push("/items/new")}
        accessibilityRole="button"
        accessibilityLabel="Add new item"
      >
        <Text style={[styles.addButtonText, { color: theme.primaryForeground }]}>+ New item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 120 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  topRow: { flexDirection: "row", gap: 8 },
  search: { borderWidth: 1, borderRadius: 16, padding: 12 },
  searchFlex: { flex: 1 },
  exportButton: {
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  exportButtonText: { fontWeight: "700" },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  chipRow: { gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  sortRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  sortButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryText: { marginTop: 12, fontSize: 14, fontWeight: "700" },
  addButton: {
    position: "absolute",
    right: 16,
    bottom: 20,
    left: 16,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  addButtonText: { fontWeight: "700" },
  skeletonList: { gap: 10 },
  skeletonRow: { height: 64, borderRadius: 18 },
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    borderRadius: 18,
  },
  swipeActionText: { fontWeight: "700" },
});
