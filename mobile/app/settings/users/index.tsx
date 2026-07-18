import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchUsers } from "../../../src/api/settings";
import { useTheme } from "../../../src/theme";
import { useAuth } from "../../../src/api/AuthContext";
import { hasPermission } from "../../../src/lib/permissions";
import { EmptyMessage, ScreenHeader, StatusMessage, Surface } from "../../../src/ui/command";

export default function UsersScreen() {
  const theme = useTheme();
  const { user: session } = useAuth();
  const canManageUsers = hasPermission(session, "MANAGE_USERS");

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: canManageUsers,
  });

  if (!canManageUsers) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusMessage theme={theme} title="User management unavailable" detail="You don't have permission to manage users." tone="permission" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        theme={theme}
        eyebrow="User directory"
        title="Manage access with a sharper control view."
        description="Review operator status, open user records, and add new staff from one command surface."
      />
      <Surface theme={theme}>
        {isLoading ? <Text style={{ color: theme.foreground }}>Loading users…</Text> : null}
        {error ? (
          <StatusMessage theme={theme} title="Could not load users." detail="Check your connection and try again." onRetry={() => refetch()} retryLabel="Retry loading users" />
        ) : null}
        {!error && !isLoading && (users?.length ?? 0) === 0 ? (
          <EmptyMessage theme={theme} title="No users yet." detail="Invite operators to give the workspace its first access roster." />
        ) : (
          <FlatList
            data={users ?? []}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Pressable style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]} onPress={() => router.push(`/settings/users/${item.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${item.name}, ${item.active ? "active" : "inactive"} user`}>
                <Text style={[styles.rowName, { color: theme.foreground }]}>{item.name}</Text>
                <Text style={{ color: item.active ? theme.success : theme.mutedForeground }}>
                  {item.active ? "Active" : "Inactive"}
                </Text>
              </Pressable>
            )}
          />
        )}
        <Pressable style={[styles.addButton, { backgroundColor: theme.primary }]} onPress={() => router.push("/settings/users/new")} accessibilityRole="button" accessibilityLabel="Create new user">
          <Text style={[styles.addButtonText, { color: theme.primaryForeground }]}>+ New user</Text>
        </Pressable>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 10,
  },
  rowName: { fontWeight: "700" },
  addButton: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 8 },
  addButtonText: { fontWeight: "700" },
});
