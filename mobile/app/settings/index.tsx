import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/api/AuthContext";

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const canManageUsers = user?.permissions.includes("MANAGE_USERS");

  async function onSignOut() {
    // The server side of /api/v1/auth/logout is a stateless no-op (JWTs
    // aren't tracked server-side), so signing out is purely a local action —
    // no network round-trip needed, and it works even fully offline.
    await signOut();
    router.replace("/login");
  }

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
      <Pressable style={styles.row} onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#eee" },
  rowText: { fontSize: 16, fontWeight: "500" },
  signOutText: { fontSize: 16, fontWeight: "500", color: "#c00" },
});
