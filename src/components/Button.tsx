import type { StyleProp, ViewStyle } from "react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../constants/theme";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
  /** Stretch to the full width of the container. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  fullWidth,
  style,
}: Props) {
  const outline = variant === "outline";
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={[
        styles.base,
        outline ? styles.outline : styles.primary,
        fullWidth && styles.fullWidth,
        inactive && styles.inactive,
        style,
      ]}
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
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: "center",
    minWidth: 160,
  },
  fullWidth: { alignSelf: "stretch", minWidth: 0 },
  primary: { backgroundColor: colors.primary },
  outline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "transparent" },
  inactive: { opacity: 0.5 },
  text: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
