import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ProductForm, { type ProductFormValues } from "../components/ProductForm";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { saveImages } from "../lib/productImages";
import { supabase } from "../lib/supabase";
import { useSeller } from "../lib/useSeller";

export default function AddProduct() {
  const router = useRouter();
  const { session } = useAuth();
  const { seller, loading } = useSeller();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!seller) return <Redirect href="/register-stall" />;

  if (seller.status !== "approved") {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Not approved yet</Text>
        <Text style={styles.sub}>You can add products once Palimbe approves your stall.</Text>
        <Button title="Go back" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  async function handleSubmit(v: ProductFormValues) {
    if (!seller || !session) return;
    setError("");
    setSaving(true);
    try {
      const urls = await saveImages(v.photos, session.user.id);
      const { error: err } = await supabase.from("products").insert({
        seller_id: seller.id,
        category_id: v.categoryId,
        title: v.title,
        description: v.description || null,
        price_mwk: v.price,
        quantity: v.quantity,
        unit: v.unit,
        images: urls,
      });
      if (err) throw err;
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProductForm
      heading="Add a product"
      submitLabel="Save product"
      saving={saving}
      error={error}
      onSubmit={handleSubmit}
      onCancel={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
