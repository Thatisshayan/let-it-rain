import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchUsers } from "../../../src/api/settings";

export default function UsersScreen() {
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <View style={styles.container}>
      {isLoading ? <Text>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={styles.error}>Could not load users.</Text>
          <Pressable onPress={() => refetch()}>
            <Text>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/settings/users/${item.id}`)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={item.active ? styles.active : styles.inactive}>
              {item.active ? "Active" : "Inactive"}
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.addButton} onPress={() => router.push("/settings/users/new")}>
        <Text style={styles.addButtonText}>+ New user</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  error: { color: "#c00" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  rowName: { fontWeight: "500" },
  active: { color: "#080" },
  inactive: { color: "#888" },
  addButton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  addButtonText: { color: "#fff", fontWeight: "600" },
});
