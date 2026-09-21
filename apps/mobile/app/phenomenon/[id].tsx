import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";
import { Text, View } from "@/components/Themed";

export default function PhenomenonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Phenomenon</Text>
      <Text style={styles.body}>{id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 16, opacity: 0.75 },
});
