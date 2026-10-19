# Palimbe Step 1: quick wins

Project root: `C:\Dev\palimbe`. Screens live in `src/app/`.

IMPORTANT ORDER: the user runs the SQL file `0002_seller_contacts.sql` in Supabase FIRST. This file only covers the app code.

What this does:
- Stall WhatsApp and phone details are no longer shown on product pages. They appear only after an order is placed (the order page). The numbers now live in a protected database table (`seller_contacts`).
- Sellers can edit and delete their products (including photos, cover photo, price and stock).
- Sellers can edit their stall details (name, section, stall number, description, WhatsApp number).

Rules for whoever applies this file (a human or an AI agent):
- Create or overwrite each file in Part A at the exact path shown, with the exact contents.
- Apply the two small edits in Part B exactly as described.
- Do not change the code, rename anything, or add extra files.
- Do not install packages. Everything needed is already installed.
- Do not touch any file that is not listed here.
- Folders that do not exist yet must be created. The folder `edit-product` contains a file literally named `[id].tsx` (the square brackets are part of the file name).

---

# PART A: files to create or replace (9 files)

## File 1: `src/lib/productImages.ts` (new)

```ts
import { supabase } from "./supabase";

// One photo in the product form. Existing photos have existingUrl set.
// Newly added photos have base64 set.
export type PhotoItem = {
  key: string;
  uri: string;
  base64?: string;
  existingUrl?: string;
};

const BUCKET = "product-images";

// Uploads a photo given as base64 text and returns its public URL.
export async function uploadImage(base64: string, userId: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < 1000) {
    throw new Error("A photo looks empty. Please remove it and add it again.");
  }

  // The folder must be the user's id (storage security rule)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes.buffer as ArrayBuffer, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Keeps existing photos as they are, uploads new ones, and keeps the order.
export async function saveImages(photos: PhotoItem[], userId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const p of photos) {
    if (p.existingUrl) urls.push(p.existingUrl);
    else if (p.base64) urls.push(await uploadImage(p.base64, userId));
  }
  return urls;
}

export function storagePathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

// Best effort: a failure to delete a file never blocks the user.
export async function removeImages(urls: string[]): Promise<void> {
  const paths = urls.map(storagePathFromUrl).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // ignore
  }
}
```

---

## File 2: `src/components/ProductForm.tsx` (new)

```tsx
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState, type ReactNode } from "react";
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
import type { PhotoItem } from "../lib/productImages";
import { supabase } from "../lib/supabase";
import Button from "./Button";
import ChipSelect, { type ChipOption } from "./ChipSelect";

export const MAX_PHOTOS = 5;
const UNITS: ChipOption[] = ["piece", "heap", "bundle", "kg", "bag"].map((u) => ({ id: u, label: u }));

export type ProductFormValues = {
  title: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
  categoryId: number;
  photos: PhotoItem[];
};

type Props = {
  heading: string;
  submitLabel: string;
  initial?: {
    title?: string;
    description?: string;
    price?: number;
    quantity?: number;
    unit?: string;
    categoryId?: number | null;
    photos?: PhotoItem[];
  };
  saving: boolean;
  error: string;
  onSubmit: (values: ProductFormValues) => void;
  onCancel: () => void;
  footer?: ReactNode;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Shrinks a photo to about 900px wide and returns it as a small JPEG (with base64 data).
async function shrink(uri: string): Promise<{ uri: string; base64: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 900 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error("Could not process the photo");
  return { uri: out.uri, base64: out.base64 };
}

export default function ProductForm({
  heading, submitLabel, initial, saving, error, onSubmit, onCancel, footer,
}: Props) {
  const [categories, setCategories] = useState<ChipOption[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>(initial?.photos ?? []);
  const [processing, setProcessing] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [priceInput, setPriceInput] = useState(initial?.price != null ? String(initial.price) : "");
  const [quantityInput, setQuantityInput] = useState(
    initial?.quantity != null ? String(initial.quantity) : ""
  );
  const [unit, setUnit] = useState<string>(initial?.unit ?? "piece");
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) =>
        setCategories((data ?? []).map((c: { id: number; name: string }) => ({ id: c.id, label: c.name })))
      );
  }, []);

  async function addFromResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    setProcessing(true);
    try {
      const prepared: PhotoItem[] = [];
      for (const asset of result.assets) {
        const small = await shrink(asset.uri);
        prepared.push({ key: newKey(), uri: small.uri, base64: small.base64 });
      }
      setPhotos((prev) => [...prev, ...prepared].slice(0, MAX_PHOTOS));
    } catch (e) {
      Alert.alert("Photo problem", e instanceof Error ? e.message : "Could not read the photo. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function choosePhotos() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    await addFromResult(result);
  }

  async function takePhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to take a product photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    await addFromResult(result);
  }

  function makeCover(index: number) {
    setPhotos((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function submit() {
    setLocalError("");
    const cleanTitle = title.trim();
    const price = Number(priceInput.replace(/,/g, ""));
    const quantity = Number(quantityInput);

    if (photos.length === 0) { setLocalError("Add at least one photo of the product"); return; }
    if (cleanTitle.length < 2) { setLocalError("Enter the product name"); return; }
    if (!Number.isFinite(price) || price <= 0) { setLocalError("Enter a valid price in MWK"); return; }
    if (!Number.isInteger(quantity) || quantity < 0) { setLocalError("Enter how many you have (a whole number)"); return; }
    if (!categoryId) { setLocalError("Choose a category"); return; }

    onSubmit({
      title: cleanTitle,
      description: description.trim(),
      price,
      quantity,
      unit,
      categoryId,
      photos,
    });
  }

  const full = photos.length >= MAX_PHOTOS;
  const shownError = localError || error;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{heading}</Text>

          <Text style={styles.label}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          <Text style={styles.hint}>
            Show different angles. The first photo is the cover shown in the shop. Tap a photo to make it the cover.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
          >
            {photos.map((p, i) => (
              <Pressable key={p.key} onPress={() => makeCover(i)} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={[styles.thumb, i === 0 && styles.thumbCover]} />
                {i === 0 && <Text style={styles.coverTag}>Cover</Text>}
                <Pressable style={styles.removeBtn} onPress={() => removePhoto(i)} hitSlop={8}>
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </Pressable>
            ))}
            {photos.length === 0 && (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <Text style={{ color: colors.muted }}>No photos</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.photoButtons}>
            <Button title="Take photo" variant="outline" onPress={takePhoto} disabled={full || processing} />
            <Button title="Choose photos" variant="outline" onPress={choosePhotos} disabled={full || processing} />
          </View>
          {processing && <Text style={styles.hint}>Preparing photos...</Text>}

          <Text style={styles.label}>Product name</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fresh tomatoes"
          />

          <Text style={styles.label}>Price (MWK)</Text>
          <TextInput
            style={styles.input}
            value={priceInput}
            onChangeText={setPriceInput}
            placeholder="e.g. 1500"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Sold by</Text>
          <ChipSelect options={UNITS} value={unit} onChange={(id) => setUnit(String(id))} />

          <Text style={styles.label}>How many do you have?</Text>
          <TextInput
            style={styles.input}
            value={quantityInput}
            onChangeText={setQuantityInput}
            placeholder="e.g. 20"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Category</Text>
          <ChipSelect
            options={categories}
            value={categoryId}
            onChange={(id) => setCategoryId(Number(id))}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Size, quality, anything buyers should know"
            multiline
          />

          {shownError ? <Text style={styles.error}>{shownError}</Text> : null}

          <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
            <Button title={submitLabel} onPress={submit} loading={saving} disabled={processing} />
            <Text style={styles.link} onPress={onCancel}>Cancel</Text>
          </View>

          {footer ? <View style={{ marginTop: 28 }}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 16, paddingVertical: 12, paddingHorizontal: 14,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: 96, height: 96, borderRadius: 12, backgroundColor: colors.surface },
  thumbCover: { borderWidth: 2, borderColor: colors.primary },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  coverTag: {
    position: "absolute", bottom: 4, left: 4, backgroundColor: colors.primary,
    color: "#fff", fontSize: 11, fontWeight: "700", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6, overflow: "hidden",
  },
  removeBtn: {
    position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center",
  },
  removeText: { color: "#fff", fontSize: 16, lineHeight: 18, fontWeight: "700" },
  photoButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  error: { color: colors.danger, marginTop: 14 },
  link: { color: colors.primary, fontSize: 15 },
});
```

---

## File 3: `src/app/add-product.tsx` (REPLACE the entire contents)

```tsx
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
```

---

## File 4: `src/app/edit-product/[id].tsx` (new; the folder is `edit-product`, the file is `[id].tsx`)

```tsx
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
```

---

## File 5: `src/app/edit-stall.tsx` (new)

```tsx
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ChipSelect, { type ChipOption } from "../components/ChipSelect";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { one } from "../lib/orders";
import { toMalawiE164 } from "../lib/phone";
import { supabase } from "../lib/supabase";

type Contact = { whatsapp_phone: string | null };
type StallRow = {
  id: string;
  stall_name: string;
  stall_number: string | null;
  description: string | null;
  section_id: number | null;
  seller_contacts: Contact | Contact[] | null;
};

export default function EditStall() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<ChipOption[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stallName, setStallName] = useState("");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [stallNumber, setStallNumber] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("market_sections")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) =>
        setSections((data ?? []).map((s: { id: number; name: string }) => ({ id: s.id, label: s.name })))
      );
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("sellers")
      .select("id, stall_name, stall_number, description, section_id, seller_contacts(whatsapp_phone)")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as unknown as StallRow | null;
        if (row) {
          setSellerId(row.id);
          setStallName(row.stall_name);
          setSectionId(row.section_id);
          setStallNumber(row.stall_number ?? "");
          setDescription(row.description ?? "");
          setWhatsapp(one(row.seller_contacts)?.whatsapp_phone ?? "");
        }
        setLoading(false);
      });
  }, [session]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!sellerId) return <Redirect href="/register-stall" />;

  async function save() {
    setError("");
    const name = stallName.trim();
    if (name.length < 2) {
      setError("Enter your stall name");
      return;
    }
    if (!sectionId) {
      setError("Choose the section of the market your stall is in");
      return;
    }
    let whatsappNumber: string | null = null;
    if (whatsapp.trim()) {
      whatsappNumber = toMalawiE164(whatsapp);
      if (!whatsappNumber) {
        setError("Enter a valid Malawi mobile number for WhatsApp, e.g. 0999 123 456");
        return;
      }
    }

    setSaving(true);
    const { data, error: err } = await supabase
      .from("sellers")
      .update({
        stall_name: name,
        section_id: sectionId,
        stall_number: stallNumber.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", sellerId)
      .select("id");

    if (err || !data || data.length === 0) {
      setSaving(false);
      setError(err?.message ?? "Could not save your stall details.");
      return;
    }

    const { error: contactErr } = await supabase
      .from("seller_contacts")
      .upsert(
        { seller_id: sellerId, whatsapp_phone: whatsappNumber, updated_at: new Date().toISOString() },
        { onConflict: "seller_id" }
      );
    setSaving(false);
    if (contactErr) {
      setError(contactErr.message);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Edit stall details</Text>

          <Text style={styles.label}>Stall name</Text>
          <TextInput style={styles.input} value={stallName} onChangeText={setStallName} />

          <Text style={styles.label}>Market section</Text>
          <ChipSelect
            options={sections}
            value={sectionId}
            onChange={(id) => setSectionId(Number(id))}
          />

          <Text style={styles.label}>Stall number (optional)</Text>
          <TextInput style={styles.input} value={stallNumber} onChangeText={setStallNumber} />

          <Text style={styles.label}>WhatsApp number (optional)</Text>
          <TextInput
            style={styles.input}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="0999 123 456"
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>
            Buyers only see this after they place an order with your stall.
          </Text>

          <Text style={styles.label}>About your stall (optional)</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
            <Button title="Save changes" onPress={save} loading={saving} />
            <Text style={styles.link} onPress={() => router.back()}>Cancel</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 16, paddingVertical: 12, paddingHorizontal: 14,
  },
  error: { color: colors.danger, marginTop: 14 },
  link: { color: colors.primary, fontSize: 15 },
});
```

---

## File 6: `src/app/register-stall.tsx` (REPLACE the entire contents)

```tsx
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ChipSelect, { type ChipOption } from "../components/ChipSelect";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { toMalawiE164 } from "../lib/phone";
import { supabase } from "../lib/supabase";

export default function RegisterStall() {
  const router = useRouter();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();

  const [sections, setSections] = useState<ChipOption[]>([]);
  const [stallName, setStallName] = useState("");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [stallNumber, setStallNumber] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("market_sections")
      .select("id, name")
      .order("sort_order")
      .then(({ data }) =>
        setSections((data ?? []).map((s: { id: number; name: string }) => ({ id: s.id, label: s.name })))
      );
  }, []);

  if (authLoading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  // Once the stall is saved, the profile becomes a seller and this redirect fires
  if (profile?.role === "seller") return <Redirect href="/(seller)/dashboard" />;

  async function submit() {
    setError("");
    const name = stallName.trim();
    if (name.length < 2) {
      setError("Enter your stall name");
      return;
    }
    if (!sectionId) {
      setError("Choose the section of the market your stall is in");
      return;
    }
    let whatsappNumber: string | null = null;
    if (whatsapp.trim()) {
      whatsappNumber = toMalawiE164(whatsapp);
      if (!whatsappNumber) {
        setError("Enter a valid Malawi mobile number for WhatsApp, e.g. 0999 123 456");
        return;
      }
    }
    if (!session) return;

    setSaving(true);
    const { data, error: err } = await supabase
      .from("sellers")
      .insert({
        user_id: session.user.id,
        stall_name: name,
        section_id: sectionId,
        stall_number: stallNumber.trim() || null,
        description: description.trim() || null,
      })
      .select("id")
      .single();

    if (err || !data) {
      setSaving(false);
      setError(err?.code === "23505" ? "You already have a stall registered." : err?.message ?? "Could not register your stall.");
      return;
    }

    // The WhatsApp number is stored privately, apart from the public stall details
    if (whatsappNumber) {
      await supabase
        .from("seller_contacts")
        .insert({ seller_id: (data as { id: string }).id, whatsapp_phone: whatsappNumber });
    }

    await refreshProfile(); // role becomes "seller", then the redirect above runs
    setSaving(false);
  }

  function cancel() {
    if (router.canGoBack()) router.back();
    else router.replace("/(buyer)/home");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Register your stall</Text>
          <Text style={styles.sub}>
            Tell buyers where to find you in Limbe Market. Palimbe will review your stall before it goes live.
          </Text>

          <Text style={styles.label}>Stall name</Text>
          <TextInput
            style={styles.input}
            value={stallName}
            onChangeText={setStallName}
            placeholder="e.g. Mama Grace Vegetables"
          />

          <Text style={styles.label}>Market section</Text>
          <ChipSelect
            options={sections}
            value={sectionId}
            onChange={(id) => setSectionId(Number(id))}
          />

          <Text style={styles.label}>Stall number (optional)</Text>
          <TextInput
            style={styles.input}
            value={stallNumber}
            onChangeText={setStallNumber}
            placeholder="e.g. B12"
          />

          <Text style={styles.label}>WhatsApp number (optional)</Text>
          <TextInput
            style={styles.input}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="0999 123 456"
            keyboardType="phone-pad"
          />
          <Text style={styles.hint}>
            Buyers only see this after they place an order with your stall.
          </Text>

          <Text style={styles.label}>About your stall (optional)</Text>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What do you sell? Opening hours?"
            multiline
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
            <Button title="Register stall" onPress={submit} loading={saving} />
            <Text style={styles.link} onPress={cancel}>Cancel</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 16, paddingVertical: 12, paddingHorizontal: 14,
  },
  error: { color: colors.danger, marginTop: 14 },
  link: { color: colors.primary, fontSize: 15 },
});
```

---

## File 7: `src/app/(seller)/dashboard.tsx` (REPLACE the entire contents)

```tsx
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { useSeller } from "../../lib/useSeller";

const STATUS = {
  pending: {
    label: "Waiting for approval",
    bg: "#FFF4E0",
    fg: "#9A5B00",
    text: "Palimbe is reviewing your stall. You can add products once it is approved.",
  },
  approved: {
    label: "Approved",
    bg: "#E6F4EC",
    fg: colors.success,
    text: "Your stall is approved. Add products so buyers can find you.",
  },
  suspended: {
    label: "Suspended",
    bg: "#FDECEA",
    fg: colors.danger,
    text: "Your stall is suspended. Please contact Palimbe support.",
  },
} as const;

export default function Dashboard() {
  const router = useRouter();
  const { seller, loading } = useSeller();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!seller) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.sub}>No stall found for this account.</Text>
        <Button title="Register your stall" onPress={() => router.push("/register-stall")} />
      </SafeAreaView>
    );
  }

  const status = STATUS[seller.status];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{seller.stall_name}</Text>
      {seller.stall_number ? <Text style={styles.sub}>Stall {seller.stall_number}</Text> : null}

      <View style={[styles.banner, { backgroundColor: status.bg }]}>
        <Text style={[styles.bannerLabel, { color: status.fg }]}>{status.label}</Text>
        <Text style={[styles.bannerText, { color: status.fg }]}>{status.text}</Text>
      </View>

      <View style={styles.actions}>
        {seller.status === "approved" && (
          <Button title="Add a product" onPress={() => router.push("/add-product")} />
        )}
        <Button
          title="Edit stall details"
          variant="outline"
          onPress={() => router.push("/edit-stall")}
        />
        <Button
          title="Back to shop"
          variant="outline"
          onPress={() => router.replace("/(buyer)/home")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginTop: 4 },
  banner: { borderRadius: 14, padding: 16, marginTop: 24 },
  bannerLabel: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  bannerText: { fontSize: 14, lineHeight: 20 },
  actions: { marginTop: 28, gap: 12, alignItems: "flex-start" },
});
```

---

## File 8: `src/app/(seller)/products.tsx` (REPLACE the entire contents)

```tsx
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
```

---

## File 9: `src/app/product/[id].tsx` (REPLACE the entire contents; the folder is `product`, the file is `[id].tsx`)

```tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, Pressable, ScrollView,
  StyleSheet, Text, useWindowDimensions, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { useCart } from "../../lib/cart";
import { formatMWK } from "../../lib/format";
import { supabase } from "../../lib/supabase";

type SellerInfo = {
  id: string;
  stall_name: string;
  stall_number: string | null;
  description: string | null;
};

type Detail = {
  id: string;
  title: string;
  description: string | null;
  price_mwk: number | string;
  quantity: number;
  unit: string;
  images: string[] | null;
  seller_id: string;
  sellers: SellerInfo | SellerInfo[] | null;
};

export default function ProductPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useCart();
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("products")
      .select(
        "id, title, description, price_mwk, quantity, unit, images, seller_id, sellers(id, stall_name, stall_number, description)"
      )
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setProduct((data as unknown as Detail) ?? null);
        setLoading(false);
      });
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
        <Text style={styles.missing}>This product is no longer available.</Text>
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
```

---

# PART B: two small edits in existing files (do these exactly)

## Edit 1: `src/lib/orders.ts`

Find this exact block:

```ts
export type StallBits = {
  stall_name: string;
  stall_number: string | null;
  whatsapp_phone: string | null;
};
```

Replace it with:

```ts
export type StallContact = { whatsapp_phone: string | null };

export type StallBits = {
  stall_name: string;
  stall_number: string | null;
  seller_contacts: StallContact | StallContact[] | null;
};
```

Then, in the same file, find this exact line (inside `BUYER_ORDER_SELECT`):

```ts
  "seller_orders(id, status, subtotal_mwk, sellers(stall_name, stall_number, whatsapp_phone), " +
```

Replace it with:

```ts
  "seller_orders(id, status, subtotal_mwk, sellers(stall_name, stall_number, seller_contacts(whatsapp_phone)), " +
```

## Edit 2: `src/app/order/[id].tsx`

Find this exact line:

```tsx
          const phone = stall?.whatsapp_phone ?? null;
```

Replace it with:

```tsx
          const phone = one(stall?.seller_contacts)?.whatsapp_phone ?? null;
```

(`one` is already imported in that file.)

---

## Files this depends on (already in the project, do not modify)

- `src/lib/supabase.ts`, `src/lib/auth.tsx`, `src/lib/useSeller.ts`, `src/lib/phone.ts`, `src/lib/format.ts`, `src/lib/cart.tsx`
- `src/constants/theme.ts`
- `src/components/Button.tsx`, `src/components/ChipSelect.tsx`
- `src/app/(seller)/_layout.tsx`
