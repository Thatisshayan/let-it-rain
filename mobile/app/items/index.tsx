import { useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchItems } from "../../src/api/items";

export default function ItemsScreen() {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["items", q, lowOnly],
    queryFn: () => fetchItems({ q, low: lowOnly }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerLinks}>
        <Pressable onPress={() => router.push("/activity")}>
          <Text>Activity</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")}>
          <Text>Settings</Text>
        </Pressable>
      </View>
      <TextInput style={styles.search} placeholder="Search items" value={q} onChangeText={setQ} />
      <Pressable onPress={() => setLowOnly((v) => !v)} style={styles.filterButton}>
        <Text>{lowOnly ? "Showing low stock only" : "Show all"}</Text>
      </Pressable>
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
        data={items ?? []}
        keyExtractor={(item) => item.id}
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
  headerLinks: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  search: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  filterButton: { padding: 8 },
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
