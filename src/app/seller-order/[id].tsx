import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import StatusBadge from "../../components/StatusBadge";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import {
  PAYMENT_LABEL, SELLER_ORDER_SELECT, describeAddress, formatDate, one, shortId,
  type SellerOrderRow, type SellerOrderStatus,
} from "../../lib/orders";
import { supabase } from "../../lib/supabase";

type Action = { label: string; to: SellerOrderStatus; danger?: boolean };

const ACTIONS: Record<SellerOrderStatus, Action[]> = {
  pending: [
    { label: "Accept order", to: "confirmed" },
    { label: "Decline", to: "declined", danger: true },
  ],
  confirmed: [
    { label: "Mark ready", to: "ready" },
    { label: "Decline", to: "declined", danger: true },
  ],
  ready: [{ label: "Mark completed", to: "completed" }],
  completed: [],
  declined: [],
  cancelled: [],
};

export default function SellerOrderPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [row, setRow] = useState<SellerOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("seller_orders")
      .select(SELLER_ORDER_SELECT)
      .eq("id", id)
      .maybeSingle();
    setRow((data as unknown as SellerOrderRow) ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(seller)/orders");
  }

  const backBar = (
    <Pressable onPress={goBack} style={styles.back}>
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );

  async function changeStatus(to: SellerOrderStatus) {
    if (!row) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("seller_orders")
      .update({ status: to })
      .eq("id", row.id)
      .select("id");
    setBusy(false);
    if (error || !data || data.length === 0) {
      Alert.alert("Could not update", error?.message ?? "You are not allowed to change this order.");
      return;
    }
    await load();
  }

  function onAction(a: Action) {
    if (a.to === "declined") {
      Alert.alert(
        "Decline this order?",
        "The items go back into your stock and the buyer is told the order was declined.",
        [
          { text: "Keep order", style: "cancel" },
          { text: "Decline", style: "destructive", onPress: () => changeStatus(a.to) },
        ]
      );
    } else {
      changeStatus(a.to);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!row) {
    return (
      <SafeAreaView style={styles.container}>
        {backBar}
        <Text style={styles.missing}>Order not found.</Text>
      </SafeAreaView>
    );
  }

  const o = one(row.orders);
  const phone = o?.buyer_phone ?? null;
  const isDelivery = o?.delivery_type === "delivery";
  const cashDue = o && o.payment_method !== "mobile_money";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {backBar}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Order #{shortId(row.order_id)}</Text>
            <Text style={styles.meta}>{formatDate(row.created_at)}</Text>
          </View>
          <StatusBadge status={row.status} forSeller />
        </View>

        <View style={styles.box}>
          <Text style={styles.boxLabel}>Buyer</Text>
          <Text style={styles.boxText}>{o?.buyer_name || "Buyer"}</Text>
          {phone && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Button
                title="WhatsApp"
                variant="outline"
                onPress={() => Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`)}
              />
              <Button title="Call" variant="outline" onPress={() => Linking.openURL(`tel:${phone}`)} />
            </View>
          )}

          <Text style={[styles.boxLabel, { marginTop: 14 }]}>
            {isDelivery ? "Deliver to" : "Pickup"}
          </Text>
          <Text style={styles.boxText}>
            {isDelivery
              ? describeAddress(o?.delivery_address ?? null) || "Address saved with the order"
              : "The buyer will collect this from your stall."}
          </Text>

          <Text style={[styles.boxLabel, { marginTop: 14 }]}>Payment</Text>
          <Text style={styles.boxText}>
            {o ? PAYMENT_LABEL[o.payment_method] : ""}
            {cashDue ? `: collect ${formatMWK(row.subtotal_mwk)}` : ""}
          </Text>

          {o?.notes ? (
            <>
              <Text style={[styles.boxLabel, { marginTop: 14 }]}>Note from the buyer</Text>
              <Text style={styles.boxText}>{o.notes}</Text>
            </>
          ) : null}
        </View>

        <Text style={styles.section}>Items</Text>
        {row.order_items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.quantity} × {item.title}
            </Text>
            <Text style={styles.itemPrice}>{formatMWK(item.line_total_mwk)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatMWK(row.subtotal_mwk)}</Text>
        </View>

        <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
          {ACTIONS[row.status].map((a) => (
            <Button
              key={a.to}
              title={a.label}
              variant={a.danger ? "outline" : "primary"}
              loading={busy}
              onPress={() => onAction(a)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { paddingHorizontal: 16, paddingVertical: 10, alignSelf: "flex-start" },
  missing: { textAlign: "center", color: colors.muted, marginTop: 60 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  box: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginTop: 16 },
  boxLabel: { fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  boxText: { fontSize: 15, color: colors.text, marginTop: 3, lineHeight: 21 },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 6 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 12 },
  itemName: { flex: 1, fontSize: 15, color: colors.text },
  itemPrice: { fontSize: 15, fontWeight: "700", color: colors.text },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8,
  },
  totalLabel: { fontSize: 16, color: colors.muted },
  totalValue: { fontSize: 20, fontWeight: "800", color: colors.text },
});
