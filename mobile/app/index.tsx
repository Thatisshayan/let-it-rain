import { Redirect } from "expo-router";
import { useAuth } from "../src/api/AuthContext";

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/items" : "/login"} />;
}
