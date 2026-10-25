import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import { fetchSellerOrders } from "../../api/orders";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import {
  formatDate, one, shortId, type SellerOrderRow,
} from "../../lib/orders";
import { useSeller } from "../../lib/useSeller";

const PAGE_SIZE = 20;

export default function SellerOrders() {
  const router = useRouter();
  const { seller, loading: sellerLoading } = useSeller();
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [nextFrom, setNextFrom] = useState(0);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!seller) return;
      if (isRefresh) setRefreshing(true);
      setError("");
      try {
        const rows = await fetchSellerOrders(seller.id, 0, PAGE_SIZE);
        setOrders(rows);
        setNextFrom(rows.length);
        setHasMore(rows.length === PAGE_SIZE);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load orders.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [seller]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = useCallback(async () => {
    if (!seller || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const rows = await fetchSellerOrders(seller.id, nextFrom, PAGE_SIZE);
      setOrders((current) => [...current, ...rows]);
      setNextFrom((current) => current + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more orders.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextFrom, seller]);

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
                {newCount} new {newCount === 1 ? "order" : "orders"} in the loaded results
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No orders yet. New orders will appear here.</Text>
        }
        ListFooterComponent={
          <View>
            {error ? <Text style={styles.empty}>{error}</Text> : null}
            {hasMore ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <Button
                  title="Load more"
                  onPress={() => void loadMore()}
                  loading={loadingMore}
                  disabled={loadingMore}
                />
              </View>
            ) : null}
          </View>
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
