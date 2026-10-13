import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { supabase } from "../../lib/supabase";

// TEMPORARY: email + password login while phone OTP (SMS) is not set up yet.
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit() {
    setError("");
    setInfo("");
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (err) setError(err.message);
      else if (!data.session) {
        setInfo("Account created. Check your email to confirm it, then sign in.");
      }
    }
    setLoading(false);
    // On success the session updates and the root layout redirects automatically
  }

  function keepBrowsing() {
    if (router.canGoBack()) router.back();
    else router.replace("/(buyer)/home");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Palimbe</Text>
        <Text style={styles.subtitle}>
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoCapitalize="none"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={{ marginTop: 24, gap: 12, alignItems: "flex-start" }}>
          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={loading}
          />
          <Text
            style={styles.link}
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setInfo("");
            }}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </Text>
          <Text style={[styles.link, { color: colors.muted }]} onPress={keepBrowsing}>
            Continue browsing
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 36, fontWeight: "800", color: colors.primary },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: colors.text },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    fontSize: 17, paddingVertical: 14, paddingHorizontal: 14,
  },
  error: { color: colors.danger, marginTop: 12 },
  info: { color: colors.primary, marginTop: 12 },
  link: { color: colors.primary, fontSize: 15, marginTop: 4 },
});
