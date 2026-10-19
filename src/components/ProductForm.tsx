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
