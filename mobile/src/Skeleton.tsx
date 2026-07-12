import { useEffect, useState } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

/** A pulsing placeholder block, used in place of "Loading..." text. */
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.base, { backgroundColor: theme.muted, opacity }, style]} />;
}

const styles = StyleSheet.create({
  base: { borderRadius: 8 },
});
