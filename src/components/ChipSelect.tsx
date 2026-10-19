import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

export type ChipOption = { id: string | number; label: string };

type Props = {
  options: ChipOption[];
  value: string | number | null;
  onChange: (id: string | number) => void;
};

export default function ChipSelect({ options, value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={String(o.id)}
            onPress={() => onChange(o.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  text: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  textActive: { color: colors.primary },
});
