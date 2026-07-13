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
import { useTheme } from "../../src/theme";

const SUBSCRIPTION_LABEL: Record<OrgInfo["subscriptionStatus"], string> = {
  NONE: "No subscription",
  TRIALING: "Trialing",
  ACTIVE: "Active",
  PAST_DUE: "Payment past due",
  CANCELED: "Canceled",
};

export default function OrganizationScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<OrgInfo | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [lowStock, setLowStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
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
  }, []);

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
      {info ? (
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Plan</Text>
          <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: "700" }}>{info.planLabel}</Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>
            {SUBSCRIPTION_LABEL[info.subscriptionStatus]} ·{" "}
            {info.seatLimit === null ? "Unlimited seats" : `${info.usage.activeUsers}/${info.seatLimit} seats used`}
          </Text>
          {info.plan === "FREE" ? (
            <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={upgrade} disabled={upgrading}>
              <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>
                {upgrading ? "Opening checkout…" : "Upgrade to Pro"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Business name</Text>
      <TextInput style={inputStyle} value={businessName} onChangeText={setBusinessName} placeholder="Your business name" placeholderTextColor={theme.mutedForeground} />

      <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Default low-stock threshold</Text>
      <TextInput style={inputStyle} value={lowStock} onChangeText={setLowStock} keyboardType="number-pad" />

      {error ? <Text style={{ color: theme.destructive }}>{error}</Text> : null}
      {success ? <Text style={{ color: theme.success }}>{success}</Text> : null}
      <Pressable style={[styles.button, { backgroundColor: theme.primary }]} onPress={save}>
        <Text style={[styles.buttonText, { color: theme.primaryForeground }]}>Save settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4, marginBottom: 8 },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12 },
  button: { padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { fontWeight: "600" },
});
