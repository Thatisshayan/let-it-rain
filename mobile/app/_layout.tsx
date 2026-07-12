import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../src/api/AuthContext";
import { AuthGate } from "../src/api/AuthGate";
import { ToastProvider, useToast } from "../src/toast";
import { useTheme } from "../src/theme";
import { startOrderQueueAutoFlush, stopOrderQueueAutoFlush } from "../src/offlineQueue";

const queryClient = new QueryClient();

function ThemedStack() {
  const theme = useTheme();
  const rqClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    startOrderQueueAutoFlush((flushedCount) => {
      toast.show(`Synced ${flushedCount} queued delivery update${flushedCount === 1 ? "" : "s"}`);
      rqClient.invalidateQueries({ queryKey: ["orders"] });
      rqClient.invalidateQueries({ queryKey: ["items"] });
      rqClient.invalidateQueries({ queryKey: ["reports"] });
    });
    return stopOrderQueueAutoFlush;
  }, [rqClient, toast]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.card },
        headerTintColor: theme.foreground,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="items/new" options={{ title: "New Item" }} />
      <Stack.Screen name="items/[id]/index" options={{ title: "Item" }} />
      <Stack.Screen name="items/[id]/edit" options={{ title: "Edit Item" }} />
      <Stack.Screen name="items/[id]/adjust" options={{ title: "Adjust Stock" }} />
      <Stack.Screen name="orders/new" options={{ title: "New Order" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="settings/account" options={{ title: "Account" }} />
      <Stack.Screen name="settings/users/index" options={{ title: "Users" }} />
      <Stack.Screen name="settings/users/new" options={{ title: "New User" }} />
      <Stack.Screen name="settings/users/[id]" options={{ title: "User" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthGate>
              <ToastProvider>
                <ThemedStack />
              </ToastProvider>
            </AuthGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
