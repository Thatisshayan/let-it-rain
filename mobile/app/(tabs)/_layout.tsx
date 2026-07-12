import { Text } from "react-native";
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

function TabIcon({ glyph, label, focused }: { glyph: string; label: string; focused: boolean }) {
  return (
    <Text
      style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {glyph}
    </Text>
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
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="🏠" label={TAB_ACCESSIBILITY.dashboard.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.dashboard.label,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="📦" label={TAB_ACCESSIBILITY.items.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: `${TAB_ACCESSIBILITY.items.label}, ${lowStockCount} low stock items`,
          tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="🚚" label={TAB_ACCESSIBILITY.orders.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.orders.label,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="📅" label={TAB_ACCESSIBILITY.activity.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.activity.label,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="📊" label={TAB_ACCESSIBILITY.reports.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.reports.label,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon glyph="⚙️" label={TAB_ACCESSIBILITY.settings.label} focused={focused} />
          ),
          tabBarAccessibilityLabel: TAB_ACCESSIBILITY.settings.label,
        }}
      />
    </Tabs>
  );
}
