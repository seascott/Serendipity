import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>
        Anonymous session on first launch, magic link to keep trips and saves. Auth wiring is in
        the shared API client.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 16, opacity: 0.75, lineHeight: 22 },
});
