import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";
import { STATUS_LABEL, type SellerOrderStatus } from "../lib/orders";

const STYLES: Record<SellerOrderStatus, { bg: string; fg: string }> = {
  pending: { bg: "#FFF4E0", fg: "#9A5B00" },
  confirmed: { bg: "#E7F1FB", fg: "#0B5CAD" },
  ready: { bg: "#E6F4EC", fg: colors.success },
  completed: { bg: "#EEEEEE", fg: "#555555" },
  declined: { bg: "#FDECEA", fg: colors.danger },
  cancelled: { bg: "#FDECEA", fg: colors.danger },
};

type Props = { status: SellerOrderStatus; forSeller?: boolean };

export default function StatusBadge({ status, forSeller }: Props) {
  const s = STYLES[status];
  const label = forSeller && status === "pending" ? "New order" : STATUS_LABEL[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
