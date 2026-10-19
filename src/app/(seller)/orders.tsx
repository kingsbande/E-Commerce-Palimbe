import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBadge from "../../components/StatusBadge";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import {
  SELLER_ORDER_SELECT, formatDate, one, shortId,
  type SellerOrderRow, type SellerOrderStatus,
} from "../../lib/orders";
import { supabase } from "../../lib/supabase";
import { useSeller } from "../../lib/useSeller";

const RANK: Record<SellerOrderStatus, number> = {
  pending: 0, confirmed: 1, ready: 2, completed: 3, declined: 4, cancelled: 4,
};

export default function SellerOrders() {
  const router = useRouter();
  const { seller, loading: sellerLoading } = useSeller();
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!seller) return;
      if (isRefresh) setRefreshing(true);
      const { data } = await supabase
        .from("seller_orders")
        .select(SELLER_ORDER_SELECT)
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false });
      const rows = ((data as unknown as SellerOrderRow[]) ?? []).slice();
      // Needs-attention orders first, newest first inside each group
      rows.sort(
        (a, b) =>
          RANK[a.status] - RANK[b.status] ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(rows);
      setLoading(false);
      setRefreshing(false);
    },
    [seller]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (sellerLoading || (seller && loading)) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const newCount = orders.filter((o) => o.status === "pending").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.title}>Orders</Text>
            {newCount > 0 && (
              <Text style={styles.newText}>
                {newCount} new {newCount === 1 ? "order" : "orders"} waiting for you
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No orders yet. New orders will appear here.</Text>
        }
        renderItem={({ item }) => {
          const o = one(item.orders);
          const summary = item.order_items.map((i) => `${i.quantity} × ${i.title}`).join(", ");
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({ pathname: "/seller-order/[id]", params: { id: item.id } })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.buyer} numberOfLines={1}>
                  {o?.buyer_name || "Buyer"}
                </Text>
                <Text style={styles.total}>{formatMWK(item.subtotal_mwk)}</Text>
              </View>
              <Text style={styles.meta}>
                #{shortId(item.order_id)} · {formatDate(item.created_at)} ·{" "}
                {o?.delivery_type === "delivery" ? "Delivery" : "Pickup"}
              </Text>
              <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
              <StatusBadge status={item.status} forSeller />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  newText: { fontSize: 14, fontWeight: "700", color: colors.primary, marginTop: 4 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 50 },
  card: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
    padding: 14, marginBottom: 12, gap: 6,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  buyer: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.text },
  total: { fontSize: 16, fontWeight: "800", color: colors.primary },
  meta: { fontSize: 13, color: colors.muted },
  summary: { fontSize: 14, color: colors.text },
});
