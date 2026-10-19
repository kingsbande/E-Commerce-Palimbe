import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ChipSelect from "../components/ChipSelect";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { useCart, type CartItem } from "../lib/cart";
import { formatMWK } from "../lib/format";
import { toMalawiE164 } from "../lib/phone";
import { supabase } from "../lib/supabase";

type Address = {
  id: string;
  label: string;
  district: string;
  area: string;
  landmark: string | null;
  is_default: boolean;
};

const ADDRESS_COLUMNS = "id, label, district, area, landmark, is_default";
const LABELS = ["Home", "Work", "Other"].map((l) => ({ id: l, label: l }));

export default function Checkout() {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const { items, total, clear } = useCart();

  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("Home");
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, { stallName: string; items: CartItem[] }>();
    for (const item of items) {
      const group = map.get(item.sellerId) ?? { stallName: item.stallName, items: [] };
      group.items.push(item);
      map.set(item.sellerId, group);
    }
    return Array.from(map.entries());
  }, [items]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("addresses")
      .select(ADDRESS_COLUMNS)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Address[];
        setAddresses(list);
        const preferred = list.find((a) => a.is_default) ?? list[0];
        if (preferred) setAddressId(preferred.id);
        if (list.length === 0) setShowForm(true);
      });
  }, [session]);

  useEffect(() => {
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [profile, phone]);

  if (authLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.empty}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Button title="Browse products" onPress={() => router.replace("/(buyer)/home")} />
      </SafeAreaView>
    );
  }

  async function saveAddress() {
    setError("");
    if (district.trim().length < 2 || area.trim().length < 2) {
      setError("Enter the district and the area");
      return;
    }
    if (!session) return;
    setSavingAddress(true);
    const { data, error: err } = await supabase
      .from("addresses")
      .insert({
        user_id: session.user.id,
        label: label || "Home",
        district: district.trim(),
        area: area.trim(),
        landmark: landmark.trim() || null,
        is_default: addresses.length === 0,
      })
      .select(ADDRESS_COLUMNS)
      .single();
    setSavingAddress(false);
    if (err || !data) {
      setError(err?.message ?? "Could not save the address");
      return;
    }
    const saved = data as Address;
    setAddresses((prev) => [saved, ...prev]);
    setAddressId(saved.id);
    setShowForm(false);
    setDistrict("");
    setArea("");
    setLandmark("");
  }

  async function placeOrder() {
    setError("");
    const buyerPhone = toMalawiE164(phone);
    if (!buyerPhone) {
      setError("Enter a valid Malawi mobile number so the stall can reach you");
      return;
    }
    if (deliveryType === "delivery" && !addressId) {
      setError("Choose or add a delivery address");
      return;
    }

    setPlacing(true);
    const { data, error: err } = await supabase.rpc("place_order", {
      p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
      p_payment_method: deliveryType === "delivery" ? "cash_on_delivery" : "pay_on_pickup",
      p_delivery_type: deliveryType,
      p_address_id: deliveryType === "delivery" ? addressId : null,
      p_buyer_phone: buyerPhone,
      p_notes: notes.trim() || null,
    });
    setPlacing(false);

    if (err) {
      setError(err.message);
      return;
    }
    clear();
    router.replace({ pathname: "/order/[id]", params: { id: String(data), placed: "1" } });
  }

  const paymentText =
    deliveryType === "delivery"
      ? "Cash on delivery: you pay the stall when your order arrives."
      : "Pay on pickup: you pay the stall when you collect your order.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Checkout</Text>

          <Text style={styles.section}>How do you want your order?</Text>
          <View style={styles.choices}>
            {(["pickup", "delivery"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setDeliveryType(opt)}
                style={[styles.choice, deliveryType === opt && styles.choiceActive]}
              >
                <Text style={[styles.choiceText, deliveryType === opt && { color: colors.primary }]}>
                  {opt === "pickup" ? "Pick up at the stall" : "Delivery"}
                </Text>
              </Pressable>
            ))}
          </View>
          {deliveryType === "delivery" && (
            <Text style={styles.hint}>
              Delivery cost is not added in the app. Agree it with the stall.
            </Text>
          )}

          {deliveryType === "delivery" && (
            <View>
              <Text style={styles.section}>Delivery address</Text>
              {addresses.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => setAddressId(a.id)}
                  style={[styles.addressCard, addressId === a.id && styles.addressActive]}
                >
                  <Text style={styles.addressTitle}>{a.label}</Text>
                  <Text style={styles.addressText}>
                    {a.area}, {a.district}
                    {a.landmark ? ` (near ${a.landmark})` : ""}
                  </Text>
                </Pressable>
              ))}

              {showForm ? (
                <View style={styles.form}>
                  <Text style={styles.fieldLabel}>Label</Text>
                  <ChipSelect options={LABELS} value={label} onChange={(id) => setLabel(String(id))} />
                  <Text style={styles.fieldLabel}>District</Text>
                  <TextInput
                    style={styles.input}
                    value={district}
                    onChangeText={setDistrict}
                    placeholder="e.g. Blantyre"
                  />
                  <Text style={styles.fieldLabel}>Area</Text>
                  <TextInput
                    style={styles.input}
                    value={area}
                    onChangeText={setArea}
                    placeholder="e.g. Chilomoni"
                  />
                  <Text style={styles.fieldLabel}>Landmark (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={landmark}
                    onChangeText={setLandmark}
                    placeholder="e.g. next to the church"
                  />
                  <View style={{ marginTop: 14, gap: 10, alignItems: "flex-start" }}>
                    <Button title="Save address" onPress={saveAddress} loading={savingAddress} />
                    {addresses.length > 0 && (
                      <Text style={styles.link} onPress={() => setShowForm(false)}>Cancel</Text>
                    )}
                  </View>
                </View>
              ) : (
                <Text style={styles.link} onPress={() => setShowForm(true)}>+ Add a new address</Text>
              )}
            </View>
          )}

          <Text style={styles.section}>Your phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="0999 123 456"
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>The stall will use this number to reach you about your order.</Text>

          <Text style={styles.section}>Note for the stall (optional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Please choose ripe tomatoes"
            multiline
          />

          <Text style={styles.section}>Payment</Text>
          <View style={styles.paymentBox}>
            <Text style={styles.paymentText}>{paymentText}</Text>
            <Text style={styles.hint}>Mobile money payments are coming soon.</Text>
          </View>

          <Text style={styles.section}>Your order</Text>
          {groups.map(([sellerId, group]) => (
            <View key={sellerId} style={styles.summaryGroup}>
              <Text style={styles.stall}>{group.stallName}</Text>
              {group.items.map((item) => (
                <View key={item.productId} style={styles.summaryRow}>
                  <Text style={styles.summaryName} numberOfLines={1}>
                    {item.quantity} × {item.title}
                  </Text>
                  <Text style={styles.summaryPrice}>{formatMWK(item.price * item.quantity)}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMWK(total)}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: 18, gap: 12, alignItems: "flex-start" }}>
            <Button title="Place order" onPress={placeOrder} loading={placing} />
            <Text style={styles.link} onPress={() => router.back()}>Back to cart</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 10 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  choices: { flexDirection: "row", gap: 12 },
  choice: {
    flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  choiceActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  choiceText: { fontSize: 15, fontWeight: "700", color: colors.muted },
  addressCard: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10,
  },
  addressActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  addressTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  addressText: { fontSize: 14, color: colors.muted, marginTop: 2 },
  form: { marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 16, paddingVertical: 12, paddingHorizontal: 14,
  },
  link: { color: colors.primary, fontSize: 15, fontWeight: "600", marginTop: 4 },
  paymentBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
  paymentText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  summaryGroup: { marginBottom: 14 },
  stall: { fontSize: 14, fontWeight: "800", color: colors.primary, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
  summaryName: { flex: 1, fontSize: 14, color: colors.text },
  summaryPrice: { fontSize: 14, fontWeight: "700", color: colors.text },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 16, color: colors.muted },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  error: { color: colors.danger, marginTop: 14 },
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
});
