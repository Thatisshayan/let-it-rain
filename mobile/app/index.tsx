import { ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/api/AuthContext";

export default function Index() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return <Redirect href={user ? "/dashboard" : "/login"} />;
}
