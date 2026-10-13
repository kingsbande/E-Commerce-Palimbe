import { useRouter, type Href } from "expo-router";
import { useAuth } from "./auth";
import { setPendingRoute } from "./pendingRoute";

// Usage: const requireAuth = useRequireAuth();
//        requireAuth("/register-stall");
// Signed-in users go straight there. Guests are sent to login first, then forwarded.
export function useRequireAuth() {
  const { session } = useAuth();
  const router = useRouter();

  return (destination: Href) => {
    if (session) {
      router.push(destination);
    } else {
      setPendingRoute(destination);
      router.push("/(auth)/login");
    }
  };
}
