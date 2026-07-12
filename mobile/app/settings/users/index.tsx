import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchUsers } from "../../../src/api/settings";
import { useTheme } from "../../../src/theme";

export default function UsersScreen() {
  const theme = useTheme();
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isLoading ? <Text style={{ color: theme.foreground }}>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={{ color: theme.destructive }}>Could not load users.</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={{ color: theme.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={() => router.push(`/settings/users/${item.id}`)}>
            <Text style={[styles.rowName, { color: theme.foreground }]}>{item.name}</Text>
            <Text style={{ color: item.active ? theme.success : theme.mutedForeground }}>
              {item.active ? "Active" : "Inactive"}
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => router.push("/settings/users/new")}>
        <Text style={[styles.addButtonText, { color: theme.primaryForeground }]}>+ New user</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
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
