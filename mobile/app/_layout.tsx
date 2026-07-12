import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/api/AuthContext";
import { AuthGate } from "../src/api/AuthGate";
import { useTheme } from "../src/theme";

const queryClient = new QueryClient();

function ThemedStack() {
  const theme = useTheme();
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
      <Stack.Screen name="settings/account" options={{ title: "Account" }} />
      <Stack.Screen name="settings/users/index" options={{ title: "Users" }} />
      <Stack.Screen name="settings/users/new" options={{ title: "New User" }} />
      <Stack.Screen name="settings/users/[id]" options={{ title: "User" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate>
            <ThemedStack />
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
