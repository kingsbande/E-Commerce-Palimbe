import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Switch, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { formatMWK } from "../../lib/format";
import { supabase } from "../../lib/supabase";
import { useSeller } from "../../lib/useSeller";

type Product = {
  id: string;
  title: string;
  price_mwk: number;
  quantity: number;
  unit: string;
  is_available: boolean;
  images: string[];
};

export default function Products() {
  const router = useRouter();
  const { seller, loading } = useSeller();
  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!seller) return;
    setFetching(true);
    const { data } = await supabase
      .from("products")
      .select("id, title, price_mwk, quantity, unit, is_available, images")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false });
    setProducts((data as Product[]) ?? []);
    setFetching(false);
  }, [seller]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  async function toggleAvailable(p: Product, value: boolean) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: value } : x)));
    const { error } = await supabase.from("products").update({ is_available: value }).eq("id", p.id);
    if (error) {
      Alert.alert("Could not update", error.message);
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
      {approved && products.length > 0 && (
        <Text style={styles.notice}>Tap a product to edit it. Use the switch to show or hide it.</Text>
      )}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        refreshing={fetching}
        onRefresh={loadProducts}
        contentContainerStyle={{ paddingBottom: 24 }}
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
