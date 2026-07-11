import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/api/AuthContext";

export default function SettingsScreen() {
  const { user } = useAuth();
  const canManageUsers = user?.permissions.includes("MANAGE_USERS");

  return (
    <View style={styles.container}>
      {canManageUsers ? (
        <Pressable style={styles.row} onPress={() => router.push("/settings/users")}>
          <Text style={styles.rowText}>Users</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.row} onPress={() => router.push("/settings/account")}>
        <Text style={styles.rowText}>Account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#eee" },
  rowText: { fontSize: 16, fontWeight: "500" },
});
