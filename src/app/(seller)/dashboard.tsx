import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../../components/Button";
import { brandGradient, colors, radius, shadow } from "../../constants/theme";
import { useSeller } from "../../lib/useSeller";

const STATUS = {
  pending: {
    label: "Waiting for approval",
    bg: "#FFF4E0",
    fg: "#9A5B00",
    icon: "time-outline" as const,
    text: "Palimbe is reviewing your stall. You can add products once it is approved.",
  },
  approved: {
    label: "Approved",
    bg: "#E6F4EC",
    fg: colors.success,
    icon: "checkmark-circle-outline" as const,
    text: "Your stall is approved. Add products so buyers can find you.",
  },
  suspended: {
    label: "Suspended",
    bg: "#FDECEA",
    fg: colors.danger,
    icon: "ban-outline" as const,
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
        <Ionicons name="storefront-outline" size={44} color={colors.muted} />
        <Text style={styles.sub}>No stall found for this account.</Text>
        <Button title="Register your stall" onPress={() => router.push("/register-stall")} />
      </SafeAreaView>
    );
  }

  const status = STATUS[seller.status];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.headerKicker}>MY STALL</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {seller.stall_name}
            </Text>
            {seller.stall_number ? (
              <View style={styles.numberPill}>
                <Ionicons name="location-outline" size={12} color={colors.primary} />
                <Text style={styles.numberPillText}>Stall {seller.stall_number}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.logoChip}>
            <Image
              source={require("../../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
        </LinearGradient>

        <View style={[styles.statusCard, { backgroundColor: status.bg }]}>
          <View style={[styles.statusIcon, { backgroundColor: "#fff" }]}>
            <Ionicons name={status.icon} size={20} color={status.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: status.fg }]}>{status.label}</Text>
            <Text style={[styles.statusText, { color: status.fg }]}>{status.text}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {seller.status === "approved" && (
            <Button
              title="Add a product"
              onPress={() => router.push("/add-product")}
              fullWidth
            />
          )}
          <Button
            title="Edit stall details"
            variant="outline"
            onPress={() => router.push("/edit-stall")}
            fullWidth
          />
          <Button
            title="Back to shop"
            variant="outline"
            onPress={() => router.replace("/(buyer)/home")}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 14, backgroundColor: colors.background,
  },
  content: { padding: 16, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.card,
  },
  headerKicker: {
    fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#fff", marginTop: 3 },
  numberPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  numberPillText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  logoChip: {
    backgroundColor: "#fff",
    borderRadius: radius.md,
    padding: 3,
  },
  logo: { width: 40, height: 40, borderRadius: radius.sm },
  statusCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: radius.lg,
    padding: 16,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  statusText: { fontSize: 13, lineHeight: 19 },
  actions: { marginTop: 6, gap: 12 },
  sub: { fontSize: 15, color: colors.muted },
});
