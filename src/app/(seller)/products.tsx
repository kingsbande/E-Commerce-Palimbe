import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Switch, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { fetchSellerProducts, setProductAvailability, type SellerProduct } from "../../api/products";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import { useSeller } from "../../lib/useSeller";

const PAGE_SIZE = 20;

export default function Products() {
  const router = useRouter();
  const { seller, loading } = useSeller();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [nextFrom, setNextFrom] = useState(0);

  const loadProducts = useCallback(async () => {
    if (!seller) return;
    setFetching(true);
    setError("");
    try {
      const rows = await fetchSellerProducts(seller.id, 0, PAGE_SIZE);
      setProducts(rows);
      setNextFrom(rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load products.");
    } finally {
      setFetching(false);
    }
  }, [seller]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const loadMore = useCallback(async () => {
    if (!seller || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const rows = await fetchSellerProducts(seller.id, nextFrom, PAGE_SIZE);
      setProducts((current) => [...current, ...rows]);
      setNextFrom((current) => current + rows.length);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more products.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextFrom, seller]);

  async function toggleAvailable(p: SellerProduct, value: boolean) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: value } : x)));
    try {
      await setProductAvailability(p.id, value);
    } catch (e) {
      Alert.alert("Could not update", e instanceof Error ? e.message : "Could not update product.");
      loadProducts();
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const approved = seller?.status === "approved";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My products</Text>
        {approved && <Button title="Add product" onPress={() => router.push("/add-product")} />}
      </View>

      {!approved && (
        <Text style={styles.notice}>You can add products once your stall is approved.</Text>
      )}
      {error ? <Text style={styles.notice}>{error}</Text> : null}
      {approved && products.length > 0 && (
        <Text style={styles.notice}>Tap a product to edit it. Use the switch to show or hide it.</Text>
      )}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        refreshing={fetching}
        onRefresh={loadProducts}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListFooterComponent={
          hasMore ? (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <Button
                title="Load more"
                onPress={() => void loadMore()}
                loading={loadingMore}
                disabled={loadingMore}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          approved && !fetching ? (
            <Text style={styles.empty}>No products yet. Tap "Add product" to list your first item.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({ pathname: "/edit-product/[id]", params: { id: item.id } })
            }
          >
            {item.images?.[0] ? (
              <Image source={{ uri: item.images[0] }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.surface }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta}>
                {formatMWK(item.price_mwk)} per {item.unit}
              </Text>
              <Text style={styles.meta}>
                {item.quantity} in stock · {item.is_available ? "Showing" : "Hidden"}
              </Text>
            </View>
            <Switch
              value={item.is_available}
              onValueChange={(v) => toggleAvailable(item, v)}
              trackColor={{ true: colors.primary }}
            />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  notice: { color: colors.muted, marginBottom: 12 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
