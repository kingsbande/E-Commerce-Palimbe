import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ChipSelect, { type ChipOption } from "../components/ChipSelect";
import { colors } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { toMalawiE164 } from "../lib/phone";
import { createSeller, insertSellerContact } from "../api/sellers";
import { useLookups } from "../lib/useLookups";
import { useSeller } from "../lib/useSeller";

export default function RegisterStall() {
  const router = useRouter();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const { reload: reloadSeller } = useSeller();

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
    const { data, error: err } = await createSeller({
        user_id: session.user.id,
        stall_name: name,
        section_id: sectionId,
        stall_number: stallNumber.trim() || null,
        description: description.trim() || null,
      });

    if (err || !data) {
      setSaving(false);
      setError(err?.code === "23505" ? "You already have a stall registered." : err?.message ?? "Could not register your stall.");
      return;
    }

    // The WhatsApp number is stored privately, apart from the public stall details
    if (whatsappNumber) {
      await insertSellerContact(data.id, whatsappNumber);
    }

    await reloadSeller();
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
