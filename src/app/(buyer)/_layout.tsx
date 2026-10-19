import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors } from "../../constants/theme";
import { useCart } from "../../lib/cart";

function tabIcon(name: ComponentProps<typeof Ionicons>["name"]) {
  const Icon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );
  return Object.assign(Icon, { displayName: `TabIcon(${name})` });
}

export default function BuyerLayout() {
  const { count } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: tabIcon("search-outline") }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: tabIcon("cart-outline"),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontWeight: "700" },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: tabIcon("receipt-outline") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("person-outline") }} />
    </Tabs>
  );
}
