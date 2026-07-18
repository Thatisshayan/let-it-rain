import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchReports, formatMoney } from "../../src/api/reports";
import { fetchItems } from "../../src/api/items";
import { fetchActivity } from "../../src/api/activity";
import { useTheme } from "../../src/theme";
import { useAuth } from "../../src/api/AuthContext";
import { hasPermission } from "../../src/lib/permissions";
import {
  EmptyMessage,
  ListRow,
  ScreenHeader,
  SectionHeading,
  StatTile,
  Surface,
} from "../../src/ui/command";

export default function DashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user: session } = useAuth();

  const canViewReports = hasPermission(session, "VIEW_REPORTS");

  const reports = useQuery({
    queryKey: ["reports", undefined],
    queryFn: () => fetchReports(),
    enabled: canViewReports,
  });
  const lowStock = useQuery({ queryKey: ["items", "", true], queryFn: () => fetchItems({ low: true }) });
  const activity = useQuery({ queryKey: ["activity", undefined], queryFn: () => fetchActivity() });

  const isRefetching = reports.isRefetching || lowStock.isRefetching || activity.isRefetching;
  async function onRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);
  }

  const recentMovements = (activity.data?.movements ?? []).slice(0, 5);

  return (
    <FlatList
      style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.primary} />}
      ListHeaderComponent={
        <View style={styles.content}>
          <ScreenHeader
            theme={theme}
            eyebrow="Saturday brief"
            title="Pressure, flow, and stock posture before the day gets noisy."
            description="Low stock, movement cadence, and revenue signal in one mobile command surface."
          />

          <View style={styles.metricGrid}>
            {canViewReports && (
              <StatTile
                theme={theme}
                label="Today's revenue"
                value={reports.data ? formatMoney(reports.data.todayRevenue) : "—"}
                hint="Same-day sales signal"
              />
            )}
            <StatTile
              theme={theme}
              label="Low stock"
              value={String(lowStock.data?.length ?? 0).padStart(2, "0")}
              hint="Lines needing replenishment"
              tone={(lowStock.data?.length ?? 0) > 0 ? "warning" : "success"}
            />
            <StatTile
              theme={theme}
              label="Recent moves"
              value={String(recentMovements.length).padStart(2, "0")}
              hint="Latest captured inventory events"
            />
          </View>

          <Surface theme={theme}>
            <SectionHeading theme={theme} label="Attention queue" title="Needs restocking" />
            <Pressable
              style={[styles.inlineButton, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}
              onPress={() => router.push("/items?low=1")}
            >
              <Text style={[styles.inlineButtonText, { color: theme.foreground }]}>Open low-stock inventory</Text>
            </Pressable>
            <View style={styles.listStack}>
              {(lowStock.data?.length ?? 0) > 0 ? (
                lowStock.data!.slice(0, 5).map((item) => (
                  <ListRow
                    key={item.id}
                    theme={theme}
                    title={item.name}
                    detail={`${item.quantity} in stock · target ${item.minStock}`}
                    meta="LOW"
                    tone="warning"
                    onPress={() => router.push(`/items/${item.id}`)}
                  />
                ))
              ) : (
                <EmptyMessage
                  theme={theme}
                  title="No low-stock pressure"
                  detail="Inventory thresholds are currently healthy."
                />
              )}
            </View>
          </Surface>

          <Surface theme={theme}>
            <SectionHeading theme={theme} label="Movement stream" title="Recent activity" />
            <View style={styles.listStack}>
              {recentMovements.length === 0 ? (
                <EmptyMessage
                  theme={theme}
                  title="No movement yet"
                  detail="Recent stock events will land here as soon as the day starts moving."
                />
              ) : (
                recentMovements.map((m) => (
                  <ListRow
                    key={m.id}
                    theme={theme}
                    title={`${m.itemName} · ${m.type}`}
                    detail={`${m.userName} recorded ${m.delta > 0 ? "+" : ""}${m.delta}`}
                    meta={m.delta > 0 ? "IN" : "OUT"}
                    tone={m.delta > 0 ? "success" : "warning"}
                  />
                ))
              )}
            </View>
          </Surface>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  listStack: { gap: 10, marginTop: 14 },
  inlineButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
