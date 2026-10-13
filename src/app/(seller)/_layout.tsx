import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useAuth } from "../../lib/auth";

function tabIcon(name: ComponentProps<typeof Ionicons>["name"]) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function SellerLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!profile) return null;
  if (profile.role !== "seller") return <Redirect href="/register-stall" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: tabIcon("stats-chart-outline") }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: "Products", tabBarIcon: tabIcon("pricetags-outline") }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: tabIcon("receipt-outline") }}
      />
    </Tabs>
  );
}
