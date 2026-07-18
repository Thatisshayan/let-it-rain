import { StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchItems } from "../../src/api/items";
import { useTheme } from "../../src/theme";

const TAB_ACCESSIBILITY: Record<string, { label: string; hint: string }> = {
  dashboard: { label: "Dashboard", hint: "Shows revenue, low stock, and recent activity" },
  items: { label: "Items", hint: "Browse and manage inventory items" },
  orders: { label: "Orders", hint: "View and manage customer orders" },
  activity: { label: "Activity", hint: "Calendar view of stock movements" },
  reports: { label: "Reports", hint: "Revenue, COGS, profit, and accounting reports" },
  settings: { label: "Settings", hint: "User management, account, and app configuration" },
};

function TabIcon({
  kind,
  label,
  focused,
  color,
}: {
  kind: "dashboard" | "items" | "orders" | "activity" | "reports" | "settings";
  label: string;
  focused: boolean;
  color: string;
}) {
  const tint = { borderColor: color, opacity: focused ? 1 : 0.72 };

  return (
    <View accessibilityRole="image" accessibilityLabel={label} style={styles.iconFrame}>
      {kind === "dashboard" ? (
        <View style={styles.gridIcon}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.gridCell, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
          ))}
        </View>
      ) : null}
      {kind === "items" ? (
        <View style={[styles.cubeOuter, tint]}>
          <View style={[styles.cubeInner, { backgroundColor: color }]} />
        </View>
      ) : null}
      {kind === "orders" ? (
        <View style={[styles.truckLine, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
      ) : null}
      {kind === "activity" ? (
        <View style={styles.barsIcon}>
          <View style={[styles.barShort, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
          <View style={[styles.barTall, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
          <View style={[styles.barMid, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
        </View>
      ) : null}
      {kind === "reports" ? (
        <View style={styles.barsIcon}>
          <View style={[styles.barShort, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
          <View style={[styles.barMid, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
          <View style={[styles.barTall, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
        </View>
      ) : null}
      {kind === "settings" ? (
        <View style={[styles.ringIcon, tint]}>
          <View style={[styles.ringDot, { backgroundColor: color, opacity: focused ? 1 : 0.72 }]} />
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { data: lowStockItems } = useQuery({
    queryKey: ["items", "", true],
    queryFn: () => fetchItems({ low: true }),
    refetchInterval: 60_000,
  });
  const lowStockCount = lowStockItems?.length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.surfaceMuted,
          borderTopColor: theme.border,
          height: 72,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.warning,
          color: theme.primaryForeground,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="dashboard" label={TAB_ACCESSIBILITY.dashboard.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.dashboard.label,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="items" label={TAB_ACCESSIBILITY.items.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: `${TAB_ACCESSIBILITY.items.label}, ${lowStockCount} low stock items`,
          tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="orders" label={TAB_ACCESSIBILITY.orders.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.orders.label,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="activity" label={TAB_ACCESSIBILITY.activity.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.activity.label,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="reports" label={TAB_ACCESSIBILITY.reports.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.reports.label,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon kind="settings" label={TAB_ACCESSIBILITY.settings.label} focused={focused} color={String(color)} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.settings.label,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  gridIcon: {
    width: 16,
    height: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  gridCell: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  cubeOuter: {
    width: 16,
    height: 16,
    borderWidth: 1.4,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cubeInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  truckLine: {
    width: 16,
    height: 3,
    borderRadius: 999,
  },
  barsIcon: {
    width: 16,
    height: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  barShort: {
    width: 4,
    height: 7,
    borderRadius: 999,
  },
  barMid: {
    width: 4,
    height: 11,
    borderRadius: 999,
  },
  barTall: {
    width: 4,
    height: 15,
    borderRadius: 999,
  },
  ringIcon: {
    width: 16,
    height: 16,
    borderWidth: 1.4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  ringDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
});
