import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "../../src/api/AuthContext";
import { getFaceIdEnabled, setFaceIdEnabled } from "../../src/api/client";
import { useTheme } from "../../src/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const canManageUsers = user?.permissions.includes("MANAGE_USERS");
  const [faceIdOn, setFaceIdOn] = useState(false);
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const [enabled, hasHardware, isEnrolled] = await Promise.all([
        getFaceIdEnabled(),
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setFaceIdOn(enabled);
      setFaceIdAvailable(hasHardware && isEnrolled);
    })();
  }, []);

  async function onToggleFaceId(value: boolean) {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm to enable Face ID unlock",
      });
      if (!result.success) return;
    }
    await setFaceIdEnabled(value);
    setFaceIdOn(value);
  }

  async function onSignOut() {
    // The server side of /api/v1/auth/logout is a stateless no-op (JWTs
    // aren't tracked server-side), so signing out is purely a local action —
    // no network round-trip needed, and it works even fully offline.
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}>
      {canManageUsers ? (
        <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={() => router.push("/settings/users")}>
          <Text style={[styles.rowText, { color: theme.foreground }]}>Users</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={() => router.push("/settings/account")}>
        <Text style={[styles.rowText, { color: theme.foreground }]}>Account</Text>
      </Pressable>
      <View style={[styles.row, { borderColor: theme.border }]}>
        <View style={styles.switchRow}>
          <Text style={[styles.rowText, { color: theme.foreground }]}>Unlock with Face ID</Text>
          <Switch
            value={faceIdOn}
            trackColor={{ true: theme.primary }}
            onValueChange={(value) => {
              if (!faceIdAvailable) {
                Alert.alert(
                  "Face ID not available",
                  "This device doesn't have Face ID set up, or it's not been enrolled in your device settings."
                );
                return;
              }
              onToggleFaceId(value);
            }}
          />
        </View>
      </View>
      <Pressable style={[styles.row, { borderColor: theme.border }]} onPress={onSignOut}>
        <Text style={[styles.signOutText, { color: theme.destructive }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { paddingVertical: 16, borderBottomWidth: 1 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowText: { fontSize: 16, fontWeight: "500" },
  signOutText: { fontSize: 16, fontWeight: "500" },
});
