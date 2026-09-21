import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby now</Text>
      <Text style={styles.body}>
        Explore will query the explore() RPC with GPS + the next 14 days. The catalog is empty
        until P1 seed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 16, opacity: 0.75, lineHeight: 22 },
});
