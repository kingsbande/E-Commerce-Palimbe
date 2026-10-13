import { Redirect } from "expo-router";

// Everyone starts in the shop. No login needed to browse.
export default function Index() {
  return <Redirect href="/(buyer)/home" />;
}
