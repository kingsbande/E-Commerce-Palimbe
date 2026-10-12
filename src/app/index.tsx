import { Redirect } from "expo-router";

export default function Index() {
  // Later: check login state and role, then send to auth, buyer or seller
  return <Redirect href="/(buyer)/home" />;
}
