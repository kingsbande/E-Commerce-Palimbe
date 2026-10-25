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
import { updateSeller, upsertSellerContact } from "../api/sellers";
import { useLookups } from "../lib/useLookups";
import { useSeller } from "../lib/useSeller";

export default function EditStall() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { seller, loading: sellerLoading, reload: reloadSeller } = useSeller();
  const { marketSections } = useLookups("marketSections");
  const sections: ChipOption[] = marketSections.map((section) => ({
    id: section.id,
    label: section.name,
  }));
  const [stallName, setStallName] = useState("");
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [stallNumber, setStallNumber] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!seller) return;
    setStallName(seller.stall_name);
    setSectionId(seller.section_id);
    setStallNumber(seller.stall_number ?? "");
    setDescription(seller.description ?? "");
    setWhatsapp(one(seller.seller_contacts)?.whatsapp_phone ?? "");
  }, [seller]);

  if (authLoading || sellerLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!seller) return <Redirect href="/register-stall" />;
  const currentSeller = seller;

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
    const { data, error: err } = await updateSeller(currentSeller.id, {
        stall_name: name,
        section_id: sectionId,
        stall_number: stallNumber.trim() || null,
        description: description.trim() || null,
      });

    if (err || !data || data.length === 0) {
      setSaving(false);
      setError(err?.message ?? "Could not save your stall details.");
      return;
    }

    const { error: contactErr } = await upsertSellerContact(currentSeller.id, whatsappNumber);
    setSaving(false);
    if (contactErr) {
      setError(contactErr.message);
      return;
    }
    await reloadSeller();
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
