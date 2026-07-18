import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";
import { useReducedMotion } from "./useReducedMotion";

type ToastState = { message: string; kind: "success" | "error" } | null;
type ToastContextValue = { show: (message: string, kind?: "success" | "error") => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [toast, setToast] = useState<ToastState>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, kind: "success" | "error" = "success") => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, kind });
      if (reducedMotion) opacity.setValue(1);
      else Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        if (reducedMotion) setToast(null);
        else Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, VISIBLE_MS);
    },
    [opacity, reducedMotion]
  );

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityRole="alert"
          style={[
            styles.toast,
            {
              top: insets.top + 8,
              opacity,
              backgroundColor: toast.kind === "success" ? theme.success : theme.destructive,
            },
          ]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 100,
  },
  text: { color: "#fff", fontWeight: "600", textAlign: "center" },
});
