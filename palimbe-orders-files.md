# Palimbe: checkout, orders and seller order handling

Project root: `C:\Dev\palimbe`. Screens live in `src/app/`.

What this adds:
- Checkout: pickup or delivery, saved addresses, contact phone, notes, order summary, and placing the real order through the secure `place_order` database function
- Payment for now: "Pay on pickup" (pickup) or "Cash on delivery" (delivery). Mobile money is shown as coming soon.
- No delivery fee in the app. The cost of delivery is agreed between the buyer and the stall.
- Buyer: order history (Orders tab) and an order detail page with one status per stall
- Seller: incoming orders (Orders tab) and an order detail page to accept, decline, mark ready and mark completed

Rules for whoever applies this file (a human or an AI agent):
- Create or overwrite each file below at the exact path shown, with the exact contents.
- Do not change the code, rename anything, or add extra files.
- Do not install packages. Everything needed is already installed.
- Do not touch any file that is not listed here.
- Folders that do not exist yet must be created. The folders `order` and `seller-order` each contain a file literally named `[id].tsx` (the square brackets are part of the file name).

There are 7 files in total.

---

## File 1: `src/lib/orders.ts` (new)

```ts
export type SellerOrderStatus =
  | "pending" | "confirmed" | "ready" | "completed" | "declined" | "cancelled";
export type DeliveryType = "delivery" | "pickup";
export type PaymentMethod = "mobile_money" | "cash_on_delivery" | "pay_on_pickup";

export type OrderItem = {
  id: string;
  title: string;
  unit_price_mwk: number | string;
  quantity: number;
  line_total_mwk: number | string;
};

export type StallBits = {
  stall_name: string;
  stall_number: string | null;
  whatsapp_phone: string | null;
};

export type DeliveryAddress = {
  label?: string;
  district?: string;
  area?: string;
  landmark?: string | null;
};

// One stall's part of a buyer's order
export type BuyerSellerOrder = {
  id: string;
  status: SellerOrderStatus;
  subtotal_mwk: number | string;
  sellers: StallBits | StallBits[] | null;
  order_items: OrderItem[];
};

export type BuyerOrder = {
  id: string;
  created_at: string;
  total_mwk: number | string;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  payment_status: string;
  delivery_address: DeliveryAddress | null;
  buyer_phone: string | null;
  notes: string | null;
  seller_orders: BuyerSellerOrder[];
};

export type OrderBits = {
  buyer_name: string;
  buyer_phone: string | null;
  delivery_type: DeliveryType;
  payment_method: PaymentMethod;
  delivery_address: DeliveryAddress | null;
  notes: string | null;
};

// An order as the stall sees it
export type SellerOrderRow = {
  id: string;
  status: SellerOrderStatus;
  subtotal_mwk: number | string;
  created_at: string;
  order_id: string;
  orders: OrderBits | OrderBits[] | null;
  order_items: OrderItem[];
};

export const BUYER_ORDER_SELECT =
  "id, created_at, total_mwk, delivery_type, payment_method, payment_status, delivery_address, buyer_phone, notes, " +
  "seller_orders(id, status, subtotal_mwk, sellers(stall_name, stall_number, whatsapp_phone), " +
  "order_items(id, title, unit_price_mwk, quantity, line_total_mwk))";

export const SELLER_ORDER_SELECT =
  "id, status, subtotal_mwk, created_at, order_id, " +
  "orders(buyer_name, buyer_phone, delivery_type, payment_method, delivery_address, notes), " +
  "order_items(id, title, unit_price_mwk, quantity, line_total_mwk)";

// The database can return a single related row as an object or as a one-item list
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const STATUS_LABEL: Record<SellerOrderStatus, string> = {
  pending: "Waiting for the stall",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash_on_delivery: "Cash on delivery",
  pay_on_pickup: "Pay on pickup",
  mobile_money: "Mobile money",
};

export function describeAddress(a: DeliveryAddress | null): string {
  if (!a) return "";
  const place = [a.area, a.district].filter(Boolean).join(", ");
  const parts = [a.label ? `${a.label}: ${place}` : place];
  if (a.landmark) parts.push(`Near ${a.landmark}`);
  return parts.join(" (") + (a.landmark ? ")" : "");
}
```

---

## File 2: `src/components/StatusBadge.tsx` (new)

```tsx
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";
import { STATUS_LABEL, type SellerOrderStatus } from "../lib/orders";

const STYLES: Record<SellerOrderStatus, { bg: string; fg: string }> = {
  pending: { bg: "#FFF4E0", fg: "#9A5B00" },
  confirmed: { bg: "#E7F1FB", fg: "#0B5CAD" },
  ready: { bg: "#E6F4EC", fg: colors.success },
  completed: { bg: "#EEEEEE", fg: "#555555" },
  declined: { bg: "#FDECEA", fg: colors.danger },
  cancelled: { bg: "#FDECEA", fg: colors.danger },
};

type Props = { status: SellerOrderStatus; forSeller?: boolean };

export default function StatusBadge({ status, forSeller }: Props) {
  const s = STYLES[status];
  const label = forSeller && status === "pending" ? "New order" : STATUS_LABEL[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
```

---

## File 3: `src/app/checkout.tsx` (REPLACE the existing placeholder)

```tsx
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
```

---

## File 4: `src/app/order/[id].tsx` (new; the folder is `order`, the file is `[id].tsx`)

```tsx
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
          const phone = stall?.whatsapp_phone ?? null;
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
```

---

## File 5: `src/app/(buyer)/orders.tsx` (REPLACE the existing contents)

```tsx
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
```

---

## File 6: `src/app/(seller)/orders.tsx` (REPLACE the existing contents)

```tsx
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
```

---

## File 7: `src/app/seller-order/[id].tsx` (new; the folder is `seller-order`, the file is `[id].tsx`)

```tsx
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
```

---

## Files this depends on (already in the project, do not modify)

- `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/cart.tsx`, `src/lib/format.ts`, `src/lib/phone.ts`, `src/lib/useSeller.ts`
- `src/constants/theme.ts` (must contain `success` and `danger` colors)
- `src/components/Button.tsx`, `src/components/ChipSelect.tsx`, `src/components/SignInPrompt.tsx`
- `src/app/_layout.tsx`
