import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  /** Show the small red bar that marks a marketplace section title. */
  accent?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export default function SectionHeader({
  title,
  subtitle,
  accent = true,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.row}>
      {accent && <View style={styles.bar} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  bar: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.primary },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 1 },
  action: { fontSize: 13, fontWeight: "600", color: colors.muted },
});
