import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { clearPendingRoute } from "../../lib/pendingRoute";
import { useRequireAuth } from "../../lib/useRequireAuth";

export default function Account() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const requireAuth = useRequireAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Guest view
  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Palimbe</Text>
        <Text style={styles.sub}>
          Browse as a guest. Create an account when you want to order or sell.
        </Text>
        <Button
          title="Sign in / Create account"
          onPress={() => {
            clearPendingRoute();
            router.push("/(auth)/login");
          }}
        />
        <Button
          title="Sell on Palimbe"
          variant="outline"
          onPress={() => requireAuth("/register-stall")}
        />
      </View>
    );
  }

  // Signed-in view
  const isSeller = profile?.role === "seller";
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile?.full_name || "Your account"}</Text>
      <Text style={styles.sub}>{session.user.email ?? profile?.phone}</Text>

      {isSeller ? (
        <Button title="Go to my stall" onPress={() => router.push("/(seller)/dashboard")} />
      ) : (
        <Button title="Sell on Palimbe" onPress={() => router.push("/register-stall")} />
      )}
      <Button title="Sign out" variant="outline" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, textAlign: "center" },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center", marginBottom: 8 },
});
