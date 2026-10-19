import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { brandGradient, colors, radius, shadow } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { useCart, type CartItem } from "../../lib/cart";
import { formatMWK } from "../../lib/format";
import { useRequireAuth } from "../../lib/useRequireAuth";

export default function Cart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { items, total, setQuantity, removeItem } = useCart();
  const requireAuth = useRequireAuth();

  const groups = useMemo(() => {
    const map = new Map<string, { stallName: string; items: CartItem[] }>();
    for (const item of items) {
      const group = map.get(item.sellerId) ?? { stallName: item.stallName, items: [] };
      group.items.push(item);
      map.set(item.sellerId, group);
    }
    return Array.from(map.entries());
  }, [items]);

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cart-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Browse the market and add what you need.</Text>
        <Pressable style={styles.emptyBtn} onPress={() => router.push("/(buyer)/home")}>
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.emptyBtnText}>Browse products</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        <Text style={styles.headerCount}>{items.length} item{items.length === 1 ? "" : "s"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {groups.map(([sellerId, group]) => (
          <View key={sellerId} style={styles.group}>
            <View style={styles.groupHead}>
              <Ionicons name="storefront" size={16} color={colors.primary} />
              <Text style={styles.stall} numberOfLines={1}>
                {group.stallName || "Limbe Market"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </View>

            {group.items.map((item) => (
              <View key={item.productId} style={styles.row}>
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/product/[id]", params: { id: item.productId } })
                  }
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Ionicons name="image-outline" size={22} color={colors.muted} />
                    </View>
                  )}
                </Pressable>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.meta}>
                    {formatMWK(item.price)} / {item.unit}
                  </Text>

                  <View style={styles.rowBottom}>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => setQuantity(item.productId, item.quantity - 1)}
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <Pressable
                        style={[styles.stepBtn, item.quantity >= item.maxQty && { opacity: 0.35 }]}
                        disabled={item.quantity >= item.maxQty}
                        onPress={() => setQuantity(item.productId, item.quantity + 1)}
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>

                    <Pressable hitSlop={8} onPress={() => removeItem(item.productId)}>
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.lineTotal}>{formatMWK(item.price * item.quantity)}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
          <Text style={styles.noteText}>
            Pay your seller directly on collection — no card needed.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {!session && (
          <Text style={styles.hint}>You’ll be asked to sign in or create an account at checkout.</Text>
        )}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMWK(total)}</Text>
          </View>
          <Pressable style={styles.checkout} onPress={() => requireAuth("/checkout")}>
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.checkoutText}>Checkout ({items.length})</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: colors.text },
  headerCount: { fontSize: 13, color: colors.muted },
  list: { padding: 12, gap: 12, paddingBottom: 24 },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.card,
  },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.primarySoft,
  },
  stall: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  thumb: { width: 76, height: 76, borderRadius: radius.sm },
  thumbFallback: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 19 },
  meta: { fontSize: 13, color: colors.primary, fontWeight: "700", marginTop: 4 },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    padding: 3,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  stepBtnText: { fontSize: 16, color: colors.text, lineHeight: 18 },
  qty: { fontSize: 14, fontWeight: "800", minWidth: 22, textAlign: "center", color: colors.text },
  lineTotal: { fontSize: 15, fontWeight: "900", color: colors.text },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#EAF7F0",
  },
  noteText: { flex: 1, fontSize: 13, color: "#1B7F4B" },
  footer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.bar,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 22, fontWeight: "900", color: colors.primary },
  checkout: {
    flex: 1,
    maxWidth: 220,
    height: 46,
    borderRadius: radius.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hint: { fontSize: 11, color: colors.muted },
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 10, backgroundColor: colors.background,
  },
  emptyIcon: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: colors.text },
  emptySub: { fontSize: 15, color: colors.muted, marginBottom: 10, textAlign: "center" },
  emptyBtn: {
    height: 46,
    borderRadius: radius.pill,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
