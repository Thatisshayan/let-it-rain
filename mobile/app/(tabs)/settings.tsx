import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "../../src/api/AuthContext";
import { getFaceIdEnabled, setFaceIdEnabled } from "../../src/api/client";
import { hasPermission } from "../../src/lib/permissions";
import { useTheme } from "../../src/theme";
import {
  ListRow,
  ScreenHeader,
  SectionHeading,
  StatTile,
  Surface,
} from "../../src/ui/command";

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const canManageUsers = hasPermission(user, "MANAGE_USERS");
  const canManageSettings = hasPermission(user, "MANAGE_SETTINGS");
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
      <View style={styles.content}>
        <ScreenHeader
          theme={theme}
          eyebrow="Control room"
          title="Access, security, and organization controls."
          description="Account controls, team access, and local device protection in one lane."
        />
        <View style={styles.metricGrid}>
          <StatTile theme={theme} label="Role" value={canManageUsers ? "Admin" : "Member"} hint="Current access posture" />
          <StatTile theme={theme} label="Biometric" value={faceIdOn ? "On" : "Off"} hint={faceIdAvailable ? "Device-ready unlock" : "Unavailable on this device"} tone={faceIdOn ? "success" : "default"} />
        </View>
        <Surface theme={theme}>
          <SectionHeading theme={theme} label="Workspace" title="Navigation and access" />
          <View style={styles.stack}>
            {canManageUsers ? (
              <ListRow
                theme={theme}
                title="Users"
                detail="Manage team members and access levels."
                onPress={() => router.push("/settings/users")}
              />
            ) : null}
            <ListRow
              theme={theme}
              title="Account"
              detail="Profile, password, and active session controls."
              onPress={() => router.push("/settings/account")}
            />
            {canManageSettings ? (
              <ListRow
                theme={theme}
                title="Organization & plan"
                detail="Business identity, defaults, and subscription posture."
                onPress={() => router.push("/settings/organization")}
              />
            ) : null}
          </View>
        </Surface>
        <Surface theme={theme}>
          <SectionHeading theme={theme} label="Security" title="Local device protection" />
          <View style={[styles.switchCard, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={[styles.rowText, { color: theme.foreground }]}>Unlock with Face ID</Text>
                <Text style={[styles.helperText, { color: theme.mutedForeground }]}>
                  Re-enter the workspace with biometric confirmation on this device.
                </Text>
              </View>
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
        </Surface>
        <Pressable style={[styles.signOutButton, { borderColor: theme.destructive, backgroundColor: theme.surfaceMuted }]} onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
          <Text style={[styles.signOutText, { color: theme.destructive }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stack: { gap: 10, marginTop: 14 },
  switchCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 14 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchText: { flex: 1, paddingRight: 12, gap: 6 },
  rowText: { fontSize: 16, fontWeight: "500" },
  helperText: { fontSize: 13, lineHeight: 18 },
  signOutButton: { borderWidth: 1, borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  signOutText: { fontSize: 16, fontWeight: "500" },
});
