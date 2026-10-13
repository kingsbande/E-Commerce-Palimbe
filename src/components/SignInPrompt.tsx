import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";
import { clearPendingRoute } from "../lib/pendingRoute";
import Button from "./Button";

export default function SignInPrompt({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Button
        title="Sign in"
        onPress={() => {
          clearPendingRoute();
          router.push("/(auth)/login");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  message: { fontSize: 16, color: colors.muted, textAlign: "center" },
});
