import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
};

export default function Button({ title, onPress, loading, disabled, variant = "primary" }: Props) {
  const outline = variant === "outline";
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[styles.base, outline ? styles.outline : styles.primary, inactive && styles.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? colors.primary : "#fff"} />
      ) : (
        <Text style={[styles.text, outline && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: "center", minWidth: 160 },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "transparent" },
  inactive: { opacity: 0.5 },
  text: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
