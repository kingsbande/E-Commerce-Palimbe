import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SignInPrompt from "../../components/SignInPrompt";
import StatusBadge from "../../components/StatusBadge";
import { colors } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { formatMWK } from "../../lib/format";
import {
  BUYER_ORDER_SELECT, formatDate, one, shortId, type BuyerOrder,
} from "../../lib/orders";
import { supabase } from "../../lib/supabase";

export default function Orders() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) setRefreshing(true);
      const { data } = await supabase
        .from("orders")
        .select(BUYER_ORDER_SELECT)
        .eq("buyer_id", session.user.id)
        .order("created_at", { ascending: false });
      setOrders((data as unknown as BuyerOrder[]) ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [session]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (authLoading) return null;
  if (!session) return <SignInPrompt message="Sign in to see your orders." />;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListHeaderComponent={<Text style={styles.title}>My orders</Text>}
        ListEmptyComponent={
          <Text style={styles.empty}>No orders yet. Your orders will appear here.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderId}>Order #{shortId(item.id)}</Text>
              <Text style={styles.total}>{formatMWK(item.total_mwk)}</Text>
            </View>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            {item.seller_orders.map((so) => (
              <View key={so.id} style={styles.stallRow}>
                <Text style={styles.stallName} numberOfLines={1}>
                  {one(so.sellers)?.stall_name ?? "Stall"}
                </Text>
                <StatusBadge status={so.status} />
              </View>
            ))}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 14 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 50 },
  card: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14,
    padding: 14, marginBottom: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 16, fontWeight: "800", color: colors.text },
  total: { fontSize: 16, fontWeight: "800", color: colors.primary },
  date: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 8 },
  stallRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 4, gap: 10,
  },
  stallName: { flex: 1, fontSize: 14, color: colors.text },
});
