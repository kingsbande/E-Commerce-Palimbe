import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import {
  BUYER_ORDER_SELECT, PAYMENT_LABEL, describeAddress, formatDate, one, shortId,
  type BuyerOrder,
} from "../../lib/orders";
import { supabase } from "../../lib/supabase";

export default function OrderPage() {
  const router = useRouter();
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      supabase
        .from("orders")
        .select(BUYER_ORDER_SELECT)
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          setOrder((data as unknown as BuyerOrder) ?? null);
          setLoading(false);
        });
    }, [id])
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(buyer)/orders");
  }

  const backBar = (
    <Pressable onPress={goBack} style={styles.back}>
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        {backBar}
        <Text style={styles.missing}>Order not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {backBar}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        {placed === "1" && (
          <View style={styles.success}>
            <Text style={styles.successTitle}>Order placed</Text>
            <Text style={styles.successText}>
              Each stall will confirm its part of your order. You can follow the progress here.
            </Text>
          </View>
        )}

        <Text style={styles.title}>Order #{shortId(order.id)}</Text>
        <Text style={styles.meta}>{formatDate(order.created_at)}</Text>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>{order.delivery_type === "delivery" ? "Delivery to" : "Pickup"}</Text>
          <Text style={styles.boxText}>
            {order.delivery_type === "delivery"
              ? describeAddress(order.delivery_address) || "Address saved with the order"
              : "Collect your order from each stall in Limbe Market."}
          </Text>
          <Text style={[styles.boxLabel, { marginTop: 12 }]}>Payment</Text>
          <Text style={styles.boxText}>{PAYMENT_LABEL[order.payment_method]}</Text>
          {order.notes ? (
            <>
              <Text style={[styles.boxLabel, { marginTop: 12 }]}>Your note</Text>
              <Text style={styles.boxText}>{order.notes}</Text>
            </>
          ) : null}
        </View>

        {order.seller_orders.map((so) => {
          const stall = one(so.sellers);
          const phone = one(stall?.seller_contacts)?.whatsapp_phone ?? null;
          return (
            <View key={so.id} style={styles.stallBox}>
              <View style={styles.stallHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stallName}>{stall?.stall_name ?? "Stall"}</Text>
                  {stall?.stall_number ? (
                    <Text style={styles.meta}>Stall {stall.stall_number}</Text>
                  ) : null}
                </View>
                <StatusBadge status={so.status} />
              </View>

              {so.order_items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.quantity} × {item.title}
                  </Text>
                  <Text style={styles.itemPrice}>{formatMWK(item.line_total_mwk)}</Text>
                </View>
              ))}

              <View style={styles.subtotalRow}>
                <Text style={styles.meta}>Subtotal</Text>
                <Text style={styles.itemPrice}>{formatMWK(so.subtotal_mwk)}</Text>
              </View>

              {phone && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Button
                    title="WhatsApp"
                    variant="outline"
                    onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
                  />
                  <Button title="Call" variant="outline" onPress={() => Linking.openURL(`tel:${phone}`)} />
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMWK(order.total_mwk)}</Text>
        </View>

        {placed === "1" && (
          <View style={{ marginTop: 20, alignItems: "flex-start" }}>
            <Button title="Continue shopping" onPress={() => router.replace("/(buyer)/home")} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  missing: { textAlign: "center", color: colors.muted, marginTop: 60 },
  success: { backgroundColor: "#E6F4EC", borderRadius: 14, padding: 16, marginBottom: 18 },
  successTitle: { fontSize: 17, fontWeight: "800", color: colors.success },
  successText: { fontSize: 14, color: colors.success, marginTop: 4, lineHeight: 20 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  box: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 16 },
  boxLabel: { fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  boxText: { fontSize: 15, color: colors.text, marginTop: 3, lineHeight: 21 },
  stallBox: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, marginTop: 16,
  },
  stallHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  stallName: { fontSize: 17, fontWeight: "800", color: colors.text },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 },
  itemName: { flex: 1, fontSize: 14, color: colors.text },
  itemPrice: { fontSize: 14, fontWeight: "700", color: colors.text },
  subtotalRow: {
    flexDirection: "row", justifyContent: "space-between", marginTop: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20,
  },
  totalLabel: { fontSize: 16, color: colors.muted },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.text },
});
