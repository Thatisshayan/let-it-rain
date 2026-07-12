import { ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/api/AuthContext";
import { useTheme } from "../src/theme";

export default function Index() {
  const theme = useTheme();
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.background }}
      >
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return <Redirect href={user ? "/dashboard" : "/login"} />;
}
