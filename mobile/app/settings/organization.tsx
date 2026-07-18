import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Linking, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import {
  fetchOrgSettings,
  updateOrgSettings,
  fetchOrgInfo,
  startCheckout,
  type OrgInfo,
} from "../../src/api/settings";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";
import { useTheme } from "../../src/theme";
import { ScreenHeader, StatTile, Surface } from "../../src/ui/command";

const SUBSCRIPTION_LABEL: Record<OrgInfo["subscriptionStatus"], string> = {
  NONE: "No subscription",
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Payment past due",
  CANCELED: "Canceled",
};

export default function OrganizationScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const canManageSettings = hasPermission(user, "MANAGE_SETTINGS");
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<OrgInfo | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [lowStock, setLowStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!canManageSettings) return;
    (async () => {
      try {
        const [settings, orgInfo] = await Promise.all([fetchOrgSettings(), fetchOrgInfo()]);
        setBusinessName(settings.businessName ?? "");
        setLowStock(String(settings.defaultLowStock));
        setInfo(orgInfo);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load organization.");
      } finally {
        setLoading(false);
      }
    })();
  }, [canManageSettings]);

  if (!canManageSettings) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.destructive }}>You don&apos;t have permission to manage organization settings.</Text>
      </View>
    );
  }

  async function save() {
    setError(null);
    setSuccess(null);
    const parsed = Number(lowStock);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Default low stock must be a whole number ≥ 0.");
      return;
    }
    try {
      await updateOrgSettings({ businessName: businessName.trim() === "" ? null : businessName.trim(), defaultLowStock: parsed });
      setSuccess("Organization settings saved.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    }
  }

  async function upgrade() {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const { url } = await startCheckout("PRO");
      await Linking.openURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start checkout.");
    } finally {
      setUpgrading(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.border, color: theme.foreground }];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: "center" }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
      <ScreenHeader
        theme={theme}
        eyebrow="Organization"
        title="Control your workspace standards."
        description="Review plan posture and tune the defaults that shape every operator’s day-to-day inventory workflow."
      />
      {info ? (
        <View style={styles.metricGrid}>
          <StatTile theme={theme} label="Plan" value={info.planLabel} hint={SUBSCRIPTION_LABEL[info.subscriptionStatus]} />
          <StatTile
            theme={theme}
            label="Seats"
            value={info.seatLimit === null ? "Unlimited" : `${info.usage.activeUsers}/${info.seatLimit}`}
            hint="Active licensed users"
          />
        </View>
      ) : null}
      <Surface theme={theme}>
        {info ? (
          <>
            {info.plan === "FREE" ? (
              <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={upgrade} disabled={upgrading} accessibilityRole="button" accessibilityLabel="Upgrade organization plan" accessibilityState={{ disabled: upgrading }}>
                <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>
                  {upgrading ? "Opening checkout…" : "Upgrade to Pro"}
                </Text>
              </Pressable>
            ) : null}
            <Text style={[styles.helperText, { color: theme.mutedForeground }]}>
              {SUBSCRIPTION_LABEL[info.subscriptionStatus]} ·{" "}
              {info.seatLimit === null ? "Unlimited seats" : `${info.usage.activeUsers}/${info.seatLimit} seats used`}
            </Text>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Business name</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Your business name"
          placeholderTextColor={theme.mutedForeground}
        />

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Default low-stock threshold</Text>
        <TextInput
          style={[...inputStyle, { backgroundColor: theme.surfaceStrong }]}
          value={lowStock}
          onChangeText={setLowStock}
          keyboardType="number-pad"
        />

        {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
        {success ? <Text style={{ color: theme.success }}>{success}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={save} accessibilityRole="button" accessibilityLabel="Save organization settings">
          <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Save settings</Text>
        </Pressable>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  helperText: { fontSize: 13, lineHeight: 19, marginTop: 8 },
  sectionTitle: { fontWeight: "700", fontSize: 16, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  button: { padding: 16, borderRadius: 18, alignItems: "center", marginTop: 8 },
  buttonText: { fontWeight: "700" },
});
