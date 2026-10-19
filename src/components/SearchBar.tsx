import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../constants/theme";

type Props = {
  /** A tap-through version that jumps to the search screen (home header). */
  onPress?: () => void;
  /** Editable version (search screen). */
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Renders on the red header wash instead of a white surface. */
  onBrand?: boolean;
};

export default function SearchBar({
  onPress,
  value,
  onChangeText,
  placeholder = "Search Limbe Market",
  autoFocus,
  onBrand,
}: Props) {
  const iconColor = onBrand ? colors.muted : colors.muted;
  const body = (
    <>
      <Ionicons name="search" size={18} color={iconColor} />
      {onChangeText ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus={autoFocus}
        />
      ) : (
        <Text style={styles.fake} numberOfLines={1}>
          {placeholder}
        </Text>
      )}
      {onChangeText ? (
        <Ionicons name="options-outline" size={18} color={iconColor} />
      ) : (
        <Ionicons name="mic-outline" size={18} color={iconColor} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={[styles.bar, styles.barShadow]} onPress={onPress}>
        {body}
      </Pressable>
    );
  }

  return <View style={[styles.bar, styles.barShadow]}>{body}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  barShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  fake: { flex: 1, fontSize: 15, color: colors.muted },
});
