import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchItem } from "../../../src/api/items";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
  });

  if (isLoading) return <Text style={styles.padded}>Loading...</Text>;
  if (error || !data) return <Text style={[styles.padded, styles.error]}>Could not load item.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data.item.name}</Text>
      <Text>
        {data.item.quantity} in stock (min {data.item.minStock})
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => router.push(`/items/${id}/adjust`)}>
          <Text style={styles.buttonText}>Adjust stock</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push(`/items/${id}/edit`)}>
          <Text>Edit item</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Movement history</Text>
      <FlatList
        data={data.movements}
        keyExtractor={(m) => m.id}
        renderItem={({ item: m }) => (
          <View style={styles.movementRow}>
            <Text>
              {m.type} {m.delta > 0 ? "+" : ""}
              {m.delta} -&gt; {m.quantityAfter}
            </Text>
            <Text style={styles.movementMeta}>
              {m.user.name} · {new Date(m.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  error: { color: "#c00" },
  title: { fontSize: 22, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginVertical: 12 },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  sectionTitle: { fontWeight: "600", marginTop: 8 },
  movementRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#eee" },
  movementMeta: { color: "#666", fontSize: 12 },
});
