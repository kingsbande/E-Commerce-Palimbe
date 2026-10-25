import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import Tracker from "../components/Tracker";
import { AuthProvider, useAuth } from "../lib/auth";
import { CartProvider } from "../lib/cart";
import { takePendingRoute } from "../lib/pendingRoute";
import { SellerProvider } from "../lib/useSeller";

function Gate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading || !session || !profile) return;

    const [first, second] = segments;
    if (first !== "(auth)") return; // guests and signed-in users can roam freely

    if (!profile.full_name) {
      // brand-new account: collect their name first
      if (second !== "welcome") router.replace("/(auth)/welcome");
      return;
    }

    // Signed in: go where they were headed, or back to the shop
    router.replace(takePendingRoute() ?? "/(buyer)/home");
  }, [loading, session, profile, segments, router]);

  return (
    <>
      <Tracker />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SellerProvider>
        <CartProvider>
          <Gate />
        </CartProvider>
      </SellerProvider>
    </AuthProvider>
  );
}
