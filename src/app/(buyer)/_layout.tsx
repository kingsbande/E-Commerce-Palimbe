import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

function tabIcon(name: ComponentProps<typeof Ionicons>["name"]) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
}

export default function BuyerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: tabIcon("search-outline") }} />
      <Tabs.Screen name="cart" options={{ title: "Cart", tabBarIcon: tabIcon("cart-outline") }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: tabIcon("receipt-outline") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}
