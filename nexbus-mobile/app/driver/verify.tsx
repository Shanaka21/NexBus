import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator, TextInput, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../../lib/api";

type Verified = { name: string; seat_numbers: number[]; seats: number; from: string; to: string; already_boarded: boolean };

export default function VerifyPassengerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The passenger reads out the 4-digit code from their booking card; the server names who it belongs to
  const verify = async () => {
    if (!/^\d{4}$/.test(code)) { setError("Enter the 4-digit code the passenger shows."); return; }
    setChecking(true);
    setVerified(null);
    setError(null);
    try {
      const { ok, data } = await apiJson(`/trips/${id}/verify-boarding`, { method: "POST", ...jsonBody({ code }) });
      if (!ok) { setError(data?.error || "That code did not match a passenger on this trip."); return; }
      setVerified(data);
      setCode("");
    } catch {
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setChecking(false);
    }
  };

  const ready = code.length === 4 && !checking;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Passenger</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Ionicons name="key-outline" size={30} color="#1a3cff" style={{ alignSelf: "center" }} />
          <Text style={styles.title}>Enter boarding code</Text>
          <Text style={styles.sub}>Ask the passenger for the 4-digit code on their booking card.</Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => { setCode(v.replace(/\D/g, "").slice(0, 4)); setVerified(null); setError(null); }}
            placeholder="0000"
            placeholderTextColor="#c5c9e0"
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            onSubmitEditing={verify}
          />

          <TouchableOpacity disabled={!ready} onPress={verify} style={[styles.button, !ready && { opacity: 0.5 }]}>
            {checking ? <ActivityIndicator color="#fff" /> : <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />}
            <Text style={styles.buttonText}>Verify</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.result, styles.resultBad]}>
            <Ionicons name="close-circle" size={26} color="#c62828" />
            <Text style={styles.badText}>{error}</Text>
          </View>
        )}

        {verified && (
          <View style={[styles.result, styles.resultGood]}>
            <Ionicons name="checkmark-circle" size={30} color="#2e7d32" />
            <View style={{ flex: 1 }}>
              <Text style={styles.goodName}>{verified.name}</Text>
              <Text style={styles.goodSub}>
                Seat {verified.seat_numbers.join(", ") || verified.seats} · {verified.from} → {verified.to}
              </Text>
              {verified.already_boarded && <Text style={styles.goodSub}>This code was already verified earlier.</Text>}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 22 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 16, gap: 14 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  title: { fontSize: 18, fontWeight: "800", color: "#1a1a4e", textAlign: "center" },
  sub: { fontSize: 13, color: "#888", textAlign: "center" },
  input: { alignSelf: "stretch", borderWidth: 1.5, borderColor: "#d5dbff", borderRadius: 14, paddingVertical: 14, textAlign: "center", fontSize: 34, fontWeight: "800", letterSpacing: 12, color: "#1a3cff", backgroundColor: "#f7f9ff" },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1a3cff", borderRadius: 14, paddingVertical: 15 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  result: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 16 },
  resultGood: { backgroundColor: "#e8f5e9" },
  resultBad: { backgroundColor: "#ffebee" },
  goodName: { fontSize: 18, fontWeight: "800", color: "#1b5e20" },
  goodSub: { fontSize: 13, color: "#2e7d32", marginTop: 2 },
  badText: { flex: 1, fontSize: 14, color: "#c62828", fontWeight: "600" },
});
