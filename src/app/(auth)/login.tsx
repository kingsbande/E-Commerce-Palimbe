import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import Button from "../../components/Button";
import { brandGradient, colors, radius } from "../../constants/theme";
import { signInWithPassword, signUpWithPassword } from "../../api/auth";

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
      const { error: err } = await signInWithPassword(cleanEmail, password);
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await signUpWithPassword(cleanEmail, password);
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
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoChip}>
              <Image
                source={require("../../../assets/images/icon.png")}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            <View>
              <Text style={styles.title}>Palimbe</Text>
              <Text style={styles.subtitle}>
                {mode === "signin" ? "Sign in to continue" : "Create your account"}
              </Text>
            </View>
          </View>
        </LinearGradient>

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

        <View style={{ marginTop: 24, gap: 12, alignItems: "stretch" }}>
          <Button
            title={mode === "signin" ? "Sign in" : "Create account"}
            onPress={submit}
            loading={loading}
            fullWidth
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
  container: { flexGrow: 1, padding: 24, justifyContent: "center", gap: 4 },
  hero: { borderRadius: 20, padding: 20, marginBottom: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoChip: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: 3,
  },
  logo: { width: 44, height: 44, borderRadius: radius.sm },
  title: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.9)", marginTop: 3 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    fontSize: 17, paddingVertical: 14, paddingHorizontal: 14,
  },
  error: { color: colors.danger, marginTop: 12 },
  info: { color: colors.primary, marginTop: 12 },
  link: { color: colors.primary, fontSize: 15, marginTop: 4 },
});
