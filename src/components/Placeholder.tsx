import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export default function Placeholder({ title, subtitle, icon = "construct-outline" }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        {subtitle ?? "This screen is coming in the next build."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
    backgroundColor: colors.background,
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
