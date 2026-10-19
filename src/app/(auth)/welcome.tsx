import { useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../components/Button";
import { colors, radius } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

// Shown once, right after a brand-new account signs in.
export default function Welcome() {
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter your name");
      return;
    }
    if (!session) return;

    setLoading(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: trimmed })
      .eq("id", session.user.id);

    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }

    await refreshProfile(); // the root layout then sends them onwards
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.logoChip}>
          <Image
            source={require("../../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.title}>Welcome to Palimbe</Text>
      </View>
      <Text style={styles.label}>What should we call you?</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Chikondi Banda"
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ marginTop: 28 }}>
        <Button title="Continue" onPress={save} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  logoChip: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  logo: { width: 40, height: 40, borderRadius: radius.sm },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, flexShrink: 1 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: colors.text },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, fontSize: 18, padding: 14 },
  error: { color: colors.danger, marginTop: 10 },
});
