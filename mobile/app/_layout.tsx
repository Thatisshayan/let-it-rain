import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/api/AuthContext";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="items/index" options={{ headerShown: false, title: "Items" }} />
            <Stack.Screen name="items/new" options={{ title: "New Item" }} />
            <Stack.Screen name="items/[id]/index" options={{ title: "Item" }} />
            <Stack.Screen name="items/[id]/edit" options={{ title: "Edit Item" }} />
            <Stack.Screen name="items/[id]/adjust" options={{ title: "Adjust Stock" }} />
            <Stack.Screen name="activity" options={{ title: "Activity" }} />
            <Stack.Screen name="reports" options={{ title: "Reports" }} />
            <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
            <Stack.Screen name="settings/account" options={{ title: "Account" }} />
            <Stack.Screen name="settings/users/index" options={{ title: "Users" }} />
            <Stack.Screen name="settings/users/new" options={{ title: "New User" }} />
            <Stack.Screen name="settings/users/[id]" options={{ title: "User" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
