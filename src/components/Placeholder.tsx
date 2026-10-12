import { Text, View } from "react-native";

export default function Placeholder({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>{title}</Text>
    </View>
  );
}
