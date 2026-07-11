import { useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchActivity, adjacentMonthParam } from "../src/api/activity";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ActivityScreen() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity", month],
    queryFn: () => fetchActivity(month),
  });

  function goToMonth(delta: number) {
    if (!data) return;
    setSelectedDay(null);
    setMonth(adjacentMonthParam(data.year, data.month, delta));
  }

  if (isLoading || !data) return <Text style={styles.padded}>Loading...</Text>;
  if (error) return <Text style={[styles.padded, styles.error]}>Could not load activity.</Text>;

  const dayMovements = selectedDay ? data.movements.filter((m) => m.createdAt.startsWith(selectedDay)) : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => goToMonth(-1)}>
          <Text>← Prev</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{data.monthLabel}</Text>
        <Pressable onPress={() => goToMonth(1)}>
          <Text>Next →</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w) => (
          <Text key={w} style={styles.weekdayLabel}>
            {w}
          </Text>
        ))}
      </View>

      {data.weeks.map((week, i) => (
        <View key={i} style={styles.weekRow}>
          {week.map((cell) => {
            const summary = data.days[cell.date];
            const dayNum = Number(cell.date.slice(-2));
            const bg = !summary
              ? undefined
              : summary.net > 0
                ? styles.cellPositive
                : summary.net < 0
                  ? styles.cellNegative
                  : styles.cellNeutral;
            return (
              <Pressable
                key={cell.date}
                style={[styles.cell, cell.inMonth ? undefined : styles.cellOutOfMonth, bg]}
                onPress={() => setSelectedDay(cell.date)}
              >
                <Text style={styles.cellDay}>{dayNum}</Text>
                {summary ? (
                  <Text style={styles.cellNet}>
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
          <Text style={styles.dayTitle}>{selectedDay}</Text>
          {dayMovements.length === 0 ? (
            <Text>No stock movements on this day.</Text>
          ) : (
            <FlatList
              data={dayMovements}
              keyExtractor={(m) => m.id}
              renderItem={({ item: m }) => (
                <View style={styles.movementRow}>
                  <Text>
                    {m.itemName} — {m.type} ({m.delta > 0 ? "+" : ""}
                    {m.delta}) by {m.userName}
                  </Text>
                  {m.reason ? <Text style={styles.movementReason}>{m.reason}</Text> : null}
                </View>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  error: { color: "#c00" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthLabel: { fontWeight: "600" },
  weekdayRow: { flexDirection: "row" },
  weekdayLabel: { flex: 1, textAlign: "center", fontSize: 12, color: "#666" },
  weekRow: { flexDirection: "row", gap: 2, marginBottom: 2 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 6,
  },
  cellOutOfMonth: { opacity: 0.3 },
  cellPositive: { backgroundColor: "#d1fae5" },
  cellNegative: { backgroundColor: "#fee2e2" },
  cellNeutral: { backgroundColor: "#e0f2fe" },
  cellDay: { fontSize: 12, fontWeight: "500" },
  cellNet: { fontSize: 9, fontWeight: "600" },
  dayDetail: { marginTop: 12, gap: 4 },
  dayTitle: { fontWeight: "600" },
  movementRow: { paddingVertical: 6, borderBottomWidth: 1, borderColor: "#eee" },
  movementReason: { fontSize: 12, color: "#666" },
});
