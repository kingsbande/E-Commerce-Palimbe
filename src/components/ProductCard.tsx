import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow } from "../constants/theme";
import { formatMWK } from "../lib/format";
import type { ProductSummary } from "../api/products";

export default function ProductCard({ product }: { product: ProductSummary }) {
  const router = useRouter();
  const lowStock = product.quantity > 0 && product.quantity <= 5;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
    >
      <View style={styles.imageWrap}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="image-outline" size={26} color={colors.muted} />
          </View>
        )}
        {lowStock ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Only {product.quantity} left</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>
          {product.title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMWK(product.price)}</Text>
          <Text style={styles.unit}>/{product.unit}</Text>
        </View>

        <View style={styles.stallRow}>
          <Ionicons name="storefront-outline" size={12} color={colors.muted} />
          <Text numberOfLines={1} style={styles.stall}>
            {product.stallName || "Limbe Market"}
            {product.stallNumber ? ` · Stall ${product.stallNumber}` : ""}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: "hidden",
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  imageWrap: { position: "relative" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.surface },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body: { padding: 10, gap: 4 },
  title: { fontSize: 14, fontWeight: "500", color: colors.text, lineHeight: 19 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  price: { fontSize: 17, fontWeight: "800", color: colors.primary },
  unit: { fontSize: 12, fontWeight: "500", color: colors.muted },
  stallRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stall: { flex: 1, fontSize: 12, color: colors.muted },
});
