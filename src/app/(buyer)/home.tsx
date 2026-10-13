import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Button from "../../components/Button";
import { colors } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { clearPendingRoute } from "../../lib/pendingRoute";

export default function Home() {
  const { session, profile } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Palimbe</Text>
      <Text style={styles.sub}>
        {session
          ? `Welcome${profile?.full_name ? ", " + profile.full_name : ""}`
          : "Browsing as a guest. Sign in when you're ready to order or sell."}
      </Text>
      {!session && (
        <Button
          title="Sign in"
          variant="outline"
          onPress={() => {
            clearPendingRoute();
            router.push("/(auth)/login");
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  title: { fontSize: 32, fontWeight: "800", color: colors.primary },
  sub: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
