import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { toMalawiE164 } from "../../lib/phone";
import { supabase } from "../../lib/supabase";

export default function Verify() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string }>();
  const phone = toMalawiE164(String(params.phone ?? ""));
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function verify() {
    setError("");
    if (!phone) { setError("Phone number missing. Go back and try again."); return; }
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setLoading(false);
    if (err) setError(err.message);
    // On success the session updates and the root layout redirects automatically
  }

  async function resend() {
    setError(""); setInfo("");
    if (!phone) return;
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    if (err) setError(err.message);
    else setInfo("A new code has been sent.");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your code</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        placeholder="------"
        maxLength={6}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
        <Button title="Verify" onPress={verify} loading={loading} />
        <Button title="Resend code" variant="outline" onPress={resend} />
        <Text style={styles.link} onPress={() => router.back()}>Change number</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 32, marginTop: 6 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 28, letterSpacing: 10, textAlign: "center", paddingVertical: 14,
  },
  error: { color: colors.danger, marginTop: 10 },
  info: { color: colors.primary, marginTop: 10 },
  link: { color: colors.primary, fontSize: 15, marginTop: 8 },
});
