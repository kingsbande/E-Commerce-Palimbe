import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { fetchProduct, type ProductDetail } from "../../api/products";
import { colors } from "../../constants/theme";
import { useCart } from "../../lib/cart";
import { formatMWK } from "../../lib/format";

export default function ProductPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useCart();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchProduct(id)
      .then((data) => {
        if (!active) return;
        setProduct(data);
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof Error ? e.message : "Could not load this product.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(buyer)/home");
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

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        {backBar}
        <Text style={styles.missing}>
          {loadError || "This product is no longer available."}
        </Text>
      </SafeAreaView>
    );
  }

  const seller = Array.isArray(product.sellers) ? product.sellers[0] : product.sellers;
  const price = Number(product.price_mwk);
  const inStock = product.quantity > 0;
  const images = product.images ?? [];

  function addToCart() {
    if (!product) return;
    addItem(
      {
        productId: product.id,
        title: product.title,
        price,
        unit: product.unit,
        image: product.images?.[0] ?? null,
        sellerId: product.seller_id,
        stallName: seller?.stall_name ?? "",
        maxQty: product.quantity,
      },
      qty
    );
    setAdded(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {backBar}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View>
          {images.length > 0 ? (
            <FlatList
              data={images}
              keyExtractor={(url) => url}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPage(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width, height: width, backgroundColor: colors.surface }} />
              )}
            />
          ) : (
            <View style={{ width, height: width, backgroundColor: colors.surface }} />
          )}
          {images.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {page + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{product.title}</Text>
          <Text style={styles.price}>
            {formatMWK(price)} <Text style={styles.unit}>/ {product.unit}</Text>
          </Text>
          <Text style={[styles.stock, !inStock && { color: colors.danger }]}>
            {inStock ? `${product.quantity} available` : "Out of stock"}
          </Text>

          {product.description ? <Text style={styles.desc}>{product.description}</Text> : null}

          {inStock && (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <Pressable style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable
                style={[styles.qtyBtn, qty >= product.quantity && { opacity: 0.35 }]}
                disabled={qty >= product.quantity}
                onPress={() => setQty((q) => Math.min(product.quantity, q + 1))}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          )}

          {inStock && (
            <View style={{ marginTop: 20, gap: 10, alignItems: "flex-start" }}>
              <Button title="Add to cart" onPress={addToCart} />
              {added && (
                <>
                  <Text style={styles.added}>Added to your cart</Text>
                  <Button
                    title="View cart"
                    variant="outline"
                    onPress={() => router.push("/(buyer)/cart")}
                  />
                </>
              )}
            </View>
          )}

          {seller && (
            <View style={styles.stallBox}>
              <Text style={styles.stallLabel}>Sold by</Text>
              <Text style={styles.stallName}>{seller.stall_name}</Text>
              {seller.stall_number ? (
                <Text style={styles.stallMeta}>Stall {seller.stall_number}, Limbe Market</Text>
              ) : null}
              {seller.description ? <Text style={styles.stallMeta}>{seller.description}</Text> : null}
              <Text style={[styles.stallMeta, { marginTop: 10 }]}>
                You will get the stall's contact details after you place your order.
              </Text>
            </View>
          )}
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
  counter: {
    position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  counterText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  price: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 6 },
  unit: { fontSize: 14, fontWeight: "500", color: colors.muted },
  stock: { fontSize: 14, color: colors.muted, marginTop: 4 },
  desc: { fontSize: 15, color: colors.text, lineHeight: 22, marginTop: 14 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20 },
  qtyLabel: { fontSize: 15, fontWeight: "600", color: colors.text, marginRight: 4 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  qtyBtnText: { fontSize: 20, color: colors.text, lineHeight: 24 },
  qty: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  added: { color: colors.primary, fontWeight: "600" },
  stallBox: {
    marginTop: 28, padding: 16, borderRadius: 14,
    backgroundColor: colors.surface,
  },
  stallLabel: { fontSize: 12, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  stallName: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 2 },
  stallMeta: { fontSize: 14, color: colors.muted, marginTop: 4 },
});
