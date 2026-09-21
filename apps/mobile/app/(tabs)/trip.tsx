import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";

export default function TripScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trip</Text>
      <Text style={styles.body}>Legs, trip items and share tokens land in P2.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 16, opacity: 0.75, lineHeight: 22 },
});
