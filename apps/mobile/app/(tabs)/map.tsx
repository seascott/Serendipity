import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text style={styles.body}>
        MapLibre/Mapbox and the time scrubber land in P1. This tab is a route placeholder.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 16, opacity: 0.75, lineHeight: 22 },
});
