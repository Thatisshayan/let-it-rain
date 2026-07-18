import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import type { Theme } from "../theme";

export function ScreenHeader({
  theme,
  eyebrow,
  title,
  description,
  right,
}: {
  theme: Theme;
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <View
      style={[
        styles.hero,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <View style={styles.heroTopRow}>
        <View style={styles.brandLockup}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>LR</Text>
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: theme.foreground }]}>Let It Rain</Text>
            <Text style={[styles.brandSubtitle, { color: theme.mutedForeground }]}>
              Operations
            </Text>
          </View>
        </View>
        {right}
      </View>
      {eyebrow ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, { color: theme.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: theme.mutedForeground }]}>{description}</Text>
      ) : null}
    </View>
  );
}

export function Surface({
  theme,
  children,
  padded = true,
}: {
  theme: Theme;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        styles.surface,
        padded && styles.surfacePadded,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeading({
  theme,
  label,
  title,
  right,
}: {
  theme: Theme;
  label?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        {label ? <Text style={[styles.eyebrow, { color: theme.primary }]}>{label}</Text> : null}
        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function StatTile({
  theme,
  label,
  value,
  hint,
  tone = "default",
}: {
  theme: Theme;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "success";
}) {
  const accent =
    tone === "warning" ? theme.warning : tone === "success" ? theme.success : theme.primary;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: theme.surfaceStrong,
          borderColor: tone === "default" ? theme.border : accent,
        },
      ]}
    >
      <Text style={[styles.tileLabel, { color: theme.mutedForeground }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: theme.foreground }]}>{value}</Text>
      {hint ? <Text style={[styles.tileHint, { color: theme.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

export function ListRow({
  theme,
  title,
  detail,
  meta,
  tone = "default",
  onPress,
  accessibilityLabel,
}: {
  theme: Theme;
  title: string;
  detail?: string;
  meta?: string;
  tone?: "default" | "warning" | "success" | "destructive";
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const color =
    tone === "warning"
      ? theme.warning
      : tone === "success"
        ? theme.success
        : tone === "destructive"
          ? theme.destructive
          : theme.mutedForeground;

  const content = (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, { color: theme.foreground }]}>{title}</Text>
        {detail ? <Text style={[styles.rowDetail, { color: theme.mutedForeground }]}>{detail}</Text> : null}
      </View>
      {meta ? <Text style={[styles.rowMeta, { color }]}>{meta}</Text> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {content}
    </Pressable>
  );
}

export function EmptyMessage({
  theme,
  title,
  detail,
}: {
  theme: Theme;
  title: string;
  detail?: string;
}) {
  return (
    <View style={[styles.emptyState, { borderColor: theme.border, backgroundColor: theme.surfaceStrong }]}>
      <Text style={[styles.emptyTitle, { color: theme.foreground }]}>{title}</Text>
      {detail ? <Text style={[styles.emptyDetail, { color: theme.mutedForeground }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    gap: 10,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 10,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4c77dd",
  },
  brandBadgeText: {
    color: "#f5f7ff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  brandSubtitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -1.1,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 320,
  },
  surface: {
    borderWidth: 1,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
  surfacePadded: {
    padding: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderText: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  tile: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  tileValue: {
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  tileHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 18,
  },
  rowTextWrap: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "right",
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyDetail: {
    fontSize: 13,
    lineHeight: 19,
  },
});
