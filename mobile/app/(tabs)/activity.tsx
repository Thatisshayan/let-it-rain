import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchActivity, adjacentMonthParam } from "../../src/api/activity";
import { useTheme } from "../../src/theme";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["activity", month],
    queryFn: () => fetchActivity(month),
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setSelectedDay(null);
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (isLoading || !data)
    return <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>Loading...</Text>;
  if (error)
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load activity.
      </Text>
    );

  const dayMovements = selectedDay ? data.movements.filter((m) => m.createdAt.startsWith(selectedDay)) : [];

  const cellBg = (net: number) =>
    net > 0 ? theme.success + "33" : net < 0 ? theme.destructive + "26" : theme.rain + "26";

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
    >
      <View style={styles.header}>
        <Pressable onPress={() => goToMonth(-1)}>
          <Text style={{ color: theme.primary }}>← Prev</Text>
        </Pressable>
        <Text style={[styles.monthLabel, { color: theme.foreground }]}>{data.monthLabel}</Text>
        <Pressable onPress={() => goToMonth(1)}>
          <Text style={{ color: theme.primary }}>Next →</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={[styles.weekdayLabel, { color: theme.mutedForeground }]}>
            {w}
          </Text>
        ))}
      </View>

      {data.weeks.map((week, i) => (
        <View key={i} style={styles.weekRow}>
          {week.map((cell) => {
            const summary = data.days[cell.date];
            const dayNum = Number(cell.date.slice(-2));
            return (
              <Pressable
                key={cell.date}
                style={[
                  styles.cell,
                  { borderColor: theme.border },
                  cell.inMonth ? undefined : styles.cellOutOfMonth,
                  summary ? { backgroundColor: cellBg(summary.net) } : undefined,
                ]}
                onPress={() => setSelectedDay(cell.date)}
              >
                <Text style={[styles.cellDay, { color: theme.foreground }]}>{dayNum}</Text>
                {summary ? (
                  <Text style={[styles.cellNet, { color: theme.foreground }]}>
                    {summary.net > 0 ? "+" : ""}
                    {summary.net}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      {selectedDay ? (
        <View style={styles.dayDetail}>
          <Text style={[styles.dayTitle, { color: theme.foreground }]}>{selectedDay}</Text>
          {dayMovements.length === 0 ? (
            <Text style={{ color: theme.mutedForeground }}>No stock movements on this day.</Text>
          ) : (
            <FlatList
              data={dayMovements}
              keyExtractor={(m) => m.id}
              scrollEnabled={false}
              renderItem={({ item: m }) => (
                <View style={[styles.movementRow, { borderColor: theme.border }]}>
                  <Text style={{ color: theme.foreground }}>
                    {m.itemName} — {m.type} ({m.delta > 0 ? "+" : ""}
                    {m.delta}) by {m.userName}
                  </Text>
                  {m.reason ? (
                    <Text style={[styles.movementReason, { color: theme.mutedForeground }]}>{m.reason}</Text>
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, gap: 8 },
  padded: { padding: 16, flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  weekdayRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12 },
  weekRow: { flexDirection: "row", gap: 2, marginBottom: 2 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 6,
  },
  cellOutOfMonth: { opacity: 0.3 },
  cellDay: { fontSize: 12, fontWeight: "500" },
  cellNet: { fontSize: 9, fontWeight: "600" },
  dayDetail: { marginTop: 12, gap: 4, paddingBottom: 24 },
  dayTitle: { fontWeight: "600" },
  movementRow: { paddingVertical: 6, borderBottomWidth: 1 },
  movementReason: { fontSize: 12 },
});
