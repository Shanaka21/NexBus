import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../../lib/api";
import { startSharing, stopSharing, type SharingMode } from "../../lib/driverTracking";
import { clockTime, msAgo } from "../../lib/format";

type Trip = {
  id: string; route_id: string; route_number: string; registration_no: string; status: string;
  scheduled_departure: number; delay_minutes: number; reservable_seats: number; available_seats: number;
  last_update_at?: number;
};

export default function DriverActiveTripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [routeName, setRouteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<SharingMode | null>(null);
  const [lastFix, setLastFix] = useState<{ status: number; at: number } | null>(null);
  const [, setTick] = useState(0);
  const resumed = useRef(false);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await apiJson("/trips");
      if (ok && Array.isArray(data)) setTrip(data.find((t: Trip) => t.id === id) || null);
    } catch { /* keep the last state */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { load(); setTick((n) => n + 1); }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!trip) return;
    apiJson(`/routes/${trip.route_id}`).then(({ ok, data }) => { if (ok) setRouteName(`${data.start_point} → ${data.end_point}`); }).catch(() => {});
  }, [trip?.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Location is collected only while the trip is running; a trip that is already running resumes sharing
  const begin = useCallback(async (tripId: string) => {
    try {
      setMode(await startSharing(tripId, setLastFix));
    } catch (err: any) {
      Alert.alert(
        err?.message === "PERMISSION" ? "Location permission needed" : "Could not share location",
        err?.message === "PERMISSION" ? "Allow location access so passengers can see where the bus is." : "Please try again."
      );
    }
  }, []);

  useEffect(() => {
    if (trip?.status === "running" && !resumed.current) { resumed.current = true; begin(trip.id); }
    if (trip && trip.status !== "running" && mode) { stopSharing(); setMode(null); }
  }, [trip, mode, begin]);

  const changeStatus = async (status: "running" | "completed") => {
    if (!trip) return;
    setBusy(true);
    try {
      const { ok, data } = await apiJson(`/trips/${trip.id}/status`, { method: "PATCH", ...jsonBody({ status }) });
      if (!ok) { Alert.alert("Error", data?.error || "Could not change the trip."); return; }
      setTrip((prev) => (prev ? { ...prev, status } : prev)); // reflect the change before the next reload
      if (status === "running") { resumed.current = true; await begin(trip.id); }
      else { await stopSharing(); setMode(null); }
      await load();
    } catch {
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnd = () =>
    Alert.alert("End trip", "Have you reached the final stop? Location sharing will stop.", [
      { text: "No", style: "cancel" },
      { text: "End trip", style: "destructive", onPress: () => changeStatus("completed") },
    ]);

  const booked = trip ? trip.reservable_seats - trip.available_seats : 0;
  const running = trip?.status === "running";
  const fixOk = lastFix && lastFix.status === 204;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{running ? "Active Trip" : "Trip"}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {loading || !trip ? (
        loading ? <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 60 }} /> : <Text style={styles.missing}>Trip not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.routeRow}>
              <View style={styles.routeBox}><Text style={styles.routeNumber}>{trip.route_number}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{routeName || `Route ${trip.route_number}`}</Text>
                <Text style={styles.sub}>Bus {trip.registration_no} · departs {clockTime(trip.scheduled_departure)}</Text>
              </View>
            </View>
            {trip.reservable_seats > 0 && (
              <View style={styles.seatBox}>
                <Ionicons name="people" size={20} color="#1a3cff" />
                <Text style={styles.seatText}>{booked} of {trip.reservable_seats} reservable seats booked</Text>
              </View>
            )}
            {trip.delay_minutes >= 10 && <Text style={styles.late}>Running {trip.delay_minutes} min late</Text>}
          </View>

          {running && (
            <View style={styles.card}>
              <View style={styles.shareRow}>
                <View style={[styles.dot, { backgroundColor: mode ? "#4caf50" : "#9e9e9e" }]} />
                <Text style={styles.shareTitle}>
                  {mode === "background" ? "Sharing location (also with the screen off)" : mode ? "Sharing location (keep this screen open)" : "Location sharing is off"}
                </Text>
              </View>
              {lastFix && (
                <Text style={[styles.sub, !fixOk && { color: "#f44336" }]}>
                  Last position sent {msAgo(lastFix.at)} {fixOk ? "(received)" : lastFix.status === 0 ? "(no connection, retrying)" : `(rejected: ${lastFix.status})`}
                </Text>
              )}
              <Text style={styles.sub}>Server last received a position: {msAgo(trip.last_update_at)}</Text>
              {!mode && (
                <TouchableOpacity style={styles.retry} onPress={() => begin(trip.id)}>
                  <Text style={styles.retryText}>Resume sharing</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.tip}>Keep the phone connected to the bus power supply: continuous GPS uses more battery.</Text>
            </View>
          )}

          {trip.status === "scheduled" && (
            <TouchableOpacity disabled={busy} onPress={() => changeStatus("running")}>
              <LinearGradient colors={["#43a047", "#2e7d32"]} style={[styles.bigButton, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="play" size={22} color="#fff" />}
                <Text style={styles.bigButtonText}>Start Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {running && (
            <TouchableOpacity disabled={busy} onPress={confirmEnd}>
              <LinearGradient colors={["#e53935", "#b71c1c"]} style={[styles.bigButton, busy && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="stop" size={22} color="#fff" />}
                <Text style={styles.bigButtonText}>End Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {(trip.status === "completed" || trip.status === "cancelled") && (
            <Text style={styles.missing}>This trip is {trip.status}.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20, gap: 14 },
  missing: { textAlign: "center", color: "#888", marginTop: 40, fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeBox: { minWidth: 52, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f0f4ff", alignItems: "center" },
  routeNumber: { fontSize: 18, fontWeight: "bold", color: "#1a3cff" },
  title: { fontSize: 16, fontWeight: "700", color: "#1a1a4e" },
  sub: { fontSize: 13, color: "#888" },
  seatBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f0f4ff", borderRadius: 12, padding: 12, marginTop: 4 },
  seatText: { fontSize: 14, fontWeight: "600", color: "#1a1a4e" },
  late: { color: "#ff9800", fontWeight: "700" },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  shareTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a4e", flex: 1 },
  retry: { alignSelf: "flex-start", backgroundColor: "#f0f4ff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  retryText: { color: "#1a3cff", fontWeight: "700" },
  tip: { fontSize: 12, color: "#aaa", marginTop: 4 },
  bigButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 16, paddingVertical: 20 },
  bigButtonText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
});
