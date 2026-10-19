import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import ProductForm, { type ProductFormValues } from "../../components/ProductForm";
import { colors } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { removeImages, saveImages, type PhotoItem } from "../../lib/productImages";
import { supabase } from "../../lib/supabase";
import { useSeller } from "../../lib/useSeller";

type Product = {
  id: string;
  title: string;
  description: string | null;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  category_id: number | null;
  seller_id: string;
};

export default function EditProduct() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { seller, loading: sellerLoading } = useSeller();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select("id, title, description, price_mwk, quantity, unit, images, category_id, seller_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setProduct((data as unknown as Product) ?? null);
        setLoading(false);
      });
  }, [id]);

  if (sellerLoading || loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!seller) return <Redirect href="/register-stall" />;

  if (!product || product.seller_id !== seller.id) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Product not found</Text>
        <Button title="Go back" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const currentProduct = product;
  const initialPhotos: PhotoItem[] = (currentProduct.images ?? []).map((url, i) => ({
    key: `existing-${i}`,
    uri: url,
    existingUrl: url,
  }));

  async function handleSubmit(v: ProductFormValues) {
    if (!session) return;
    setError("");
    setSaving(true);
    try {
      const urls = await saveImages(v.photos, session.user.id);
      const { data, error: err } = await supabase
        .from("products")
        .update({
          category_id: v.categoryId,
          title: v.title,
          description: v.description || null,
          price_mwk: v.price,
          quantity: v.quantity,
          unit: v.unit,
          images: urls,
        })
        .eq("id", currentProduct.id)
        .select("id");
      if (err) throw err;
      if (!data || data.length === 0) throw new Error("You are not allowed to change this product.");

      // Tidy up photos the seller removed (best effort)
      const removed = (currentProduct.images ?? []).filter((u) => !urls.includes(u));
      await removeImages(removed);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete this product?",
      "It will disappear from the shop. Past orders keep their record of what was bought. To only pause selling, switch it off in the Products list instead.",
      [
        { text: "Keep product", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            const { data, error: err } = await supabase
              .from("products")
              .delete()
              .eq("id", currentProduct.id)
              .select("id");
            if (err || !data || data.length === 0) {
              setSaving(false);
              Alert.alert("Could not delete", err?.message ?? "You are not allowed to delete this product.");
              return;
            }
            await removeImages(currentProduct.images ?? []);
            setSaving(false);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <ProductForm
      heading="Edit product"
      submitLabel="Save changes"
      initial={{
        title: currentProduct.title,
        description: currentProduct.description ?? "",
        price: Number(currentProduct.price_mwk),
        quantity: currentProduct.quantity,
        unit: currentProduct.unit,
        categoryId: currentProduct.category_id,
        photos: initialPhotos,
      }}
      saving={saving}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
      footer={<Button title="Delete product" variant="outline" onPress={confirmDelete} />}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
});
