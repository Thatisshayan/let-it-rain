import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchActivity, adjacentMonthParam } from "../../src/api/activity";
import { useTheme } from "../../src/theme";
import {
  EmptyMessage,
  ScreenHeader,
  SectionHeading,
  StatTile,
  Surface,
} from "../../src/ui/command";

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

  if (isLoading || !data) {
    return (
      <Text style={[styles.padded, { color: theme.foreground, backgroundColor: theme.background }]}>
        Loading...
      </Text>
    );
  }

  if (error) {
    return (
      <Text style={[styles.padded, { color: theme.destructive, backgroundColor: theme.background }]}>
        Could not load activity.
      </Text>
    );
  }

  const dayMovements = selectedDay
    ? data.movements.filter((m) => m.createdAt.startsWith(selectedDay))
    : [];
  const activeDays = Object.keys(data.days).length;
  const totalNet = Object.values(data.days).reduce((sum, day) => sum + day.net, 0);

  const cellBg = (net: number) =>
    net > 0 ? `${theme.success}33` : net < 0 ? `${theme.destructive}26` : `${theme.rain}26`;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16, backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
    >
      <View style={styles.content}>
        <ScreenHeader
          theme={theme}
          eyebrow="Movement calendar"
          title="See the stock rhythm before you drill into the day ledger."
          description="Calendar density shows when inventory moved, in which direction, and where to inspect detail."
        />

        <View style={styles.metricGrid}>
          <StatTile theme={theme} label="Period" value={`${data.year}-${String(data.month).padStart(2, "0")}`} hint="Current calendar slice" />
          <StatTile theme={theme} label="Active days" value={String(activeDays).padStart(2, "0")} hint="Days with movement" />
          <StatTile
            theme={theme}
            label="Net delta"
            value={`${totalNet > 0 ? "+" : ""}${totalNet}`}
            hint="Aggregate stock change"
            tone={totalNet > 0 ? "success" : totalNet < 0 ? "warning" : "default"}
          />
        </View>

        <Surface theme={theme}>
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
                const selected = selectedDay === cell.date;

                return (
                  <Pressable
                    key={cell.date}
                    style={[
                      styles.cell,
                      { borderColor: theme.border, backgroundColor: theme.surfaceStrong },
                      cell.inMonth ? undefined : styles.cellOutOfMonth,
                      summary ? { backgroundColor: cellBg(summary.net) } : undefined,
                      selected ? { borderColor: theme.primary, borderWidth: 2 } : undefined,
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
        </Surface>

        {selectedDay ? (
          <Surface theme={theme}>
            <SectionHeading theme={theme} label="Selected day" title={selectedDay} />
            {dayMovements.length === 0 ? (
              <EmptyMessage
                theme={theme}
                title="No stock movements on this day."
                detail="No ledger activity was recorded for the selected date."
              />
            ) : (
              <FlatList
                data={dayMovements}
                keyExtractor={(m) => m.id}
                scrollEnabled={false}
                contentContainerStyle={styles.movementList}
                renderItem={({ item: m }) => (
                  <View style={[styles.movementRow, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
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
          </Surface>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  padded: { padding: 16, flex: 1 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  monthLabel: { fontWeight: "700", fontSize: 15 },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "600" },
  weekRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 14,
  },
  cellOutOfMonth: { opacity: 0.3 },
  cellDay: { fontSize: 12, fontWeight: "700" },
  cellNet: { fontSize: 10, fontWeight: "700" },
  movementList: { gap: 10, marginTop: 14 },
  movementRow: { padding: 14, borderWidth: 1, borderRadius: 18 },
  movementReason: { fontSize: 12, marginTop: 6 },
});
