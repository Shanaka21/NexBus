import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import MapView, { Marker, Polyline, BaseTiles, baseMapType, mapProvider } from "../../lib/maps";
import { apiJson, jsonBody } from "../../lib/api";
import { startSharing, stopSharing, type SharingMode } from "../../lib/driverTracking";
import { clockTime, msAgo, stopLabel } from "../../lib/format";

type Passenger = { booking_id: string; name: string; seat_numbers: number[]; seats: number; from: string; to: string; boarded: boolean };

type Trip = {
  passengers?: Passenger[];
  id: string; route_id: string; route_number: string; registration_no: string; status: string;
  scheduled_departure: number; delay_minutes: number; reservable_seats: number; available_seats: number;
  last_update_at?: number; last_latitude?: number | null; last_longitude?: number | null;
};

type RouteStop = { stopId: string; name: string; nameSi?: string; lat: number; lng: number; sequenceNo: number };
type RouteDetail = { route_name?: string; start_point?: string; end_point?: string; stops: RouteStop[] };

type TripSummary = {
  status: string; distance_km: number; duration_min: number | null; avg_speed_kmh: number | null;
  fixes_count: number; passengers: number | null;
};

export default function DriverActiveTripScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<SharingMode | null>(null);
  const [lastFix, setLastFix] = useState<{ status: number; at: number } | null>(null);
  const [, setTick] = useState(0);
  const resumed = useRef(false);

  const routeName = route ? route.route_name || `${route.start_point} → ${route.end_point}` : "";

  const load = useCallback(async () => {
    try {
      const { ok, data } = await apiJson("/trips");
      if (ok && Array.isArray(data)) setTrip(data.find((t: Trip) => t.id === id) || null);
    } catch { /* keep the last state */ } finally { setLoading(false); }
  }, [id]);

  // coming back from the verify screen shows the new tick straight away
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    load();
    const timer = setInterval(() => { load(); setTick((n) => n + 1); }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!trip) return;
    apiJson(`/routes/${trip.route_id}`).then(({ ok, data }) => { if (ok) setRoute(data); }).catch(() => {});
  }, [trip?.route_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Finished trips show a distance/duration summary instead of live controls; fetched once, not polled.
  useEffect(() => {
    if (!trip || !["completed", "cancelled"].includes(trip.status)) return;
    apiJson(`/trips/${trip.id}/summary`).then(({ ok, data }) => { if (ok) setSummary(data); }).catch(() => {});
  }, [trip?.id, trip?.status]);

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

          {trip.reservable_seats > 0 && trip.status !== "cancelled" && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Passengers</Text>

              {["scheduled", "running"].includes(trip.status) && (
                <TouchableOpacity style={styles.verifyBtn} onPress={() => router.push({ pathname: "/driver/verify", params: { id: trip.id } } as any)}>
                  <Ionicons name="key-outline" size={18} color="#fff" />
                  <Text style={styles.verifyBtnText}>Verify passenger code</Text>
                </TouchableOpacity>
              )}

              {!trip.passengers?.length ? (
                <Text style={styles.sub}>No paid bookings on this trip yet.</Text>
              ) : (
                trip.passengers.map((pax) => (
                  <View key={pax.booking_id} style={styles.paxRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paxName}>{pax.name}</Text>
                      <Text style={styles.sub}>{pax.from} → {pax.to}</Text>
                    </View>
                    <View style={styles.paxSeats}>
                      <Text style={styles.paxSeatsText}>Seat {pax.seat_numbers.join(", ") || pax.seats}</Text>
                    </View>
                    <Ionicons name={pax.boarded ? "checkmark-circle" : "ellipse-outline"} size={20} color={pax.boarded ? "#4caf50" : "#ccc"} />
                  </View>
                ))
              )}
            </View>
          )}

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

          {running && !!route?.stops?.length && (
            <View style={[styles.card, styles.mapCard]}>
              <MapView
                style={styles.map}
                provider={mapProvider}
                mapType={baseMapType}
                pointerEvents="none"
                initialRegion={{
                  latitude: trip.last_latitude ?? route.stops[0].lat,
                  longitude: trip.last_longitude ?? route.stops[0].lng,
                  latitudeDelta: 0.12,
                  longitudeDelta: 0.12,
                }}
              >
                <BaseTiles />
                <Polyline
                  coordinates={route.stops.slice().sort((a, b) => a.sequenceNo - b.sequenceNo).map((s) => ({ latitude: s.lat, longitude: s.lng }))}
                  strokeColor="#1a3cff"
                  strokeWidth={3}
                />
                {trip.last_latitude != null && trip.last_longitude != null && (
                  <Marker coordinate={{ latitude: trip.last_latitude, longitude: trip.last_longitude }}>
                    <View style={styles.busMarker}><Ionicons name="bus" size={13} color="#fff" /></View>
                  </Marker>
                )}
              </MapView>
              <Text style={styles.mapCaption}>
                {stopLabel(route.stops[0])} → {stopLabel(route.stops[route.stops.length - 1])}
              </Text>
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
            <View style={styles.card}>
              <View style={styles.summaryHeader}>
                <Ionicons name={trip.status === "completed" ? "checkmark-circle" : "close-circle"} size={18} color={trip.status === "completed" ? "#4caf50" : "#f44336"} />
                <Text style={styles.summaryHeaderText}>This trip is {trip.status}.</Text>
              </View>
              {!summary ? (
                <ActivityIndicator size="small" color="#1a3cff" style={{ marginTop: 10 }} />
              ) : (
                <View style={styles.summaryGrid}>
                  <SummaryStat icon="navigate-outline" label="Distance" value={`${summary.distance_km} km`} />
                  <SummaryStat icon="time-outline" label="Duration" value={summary.duration_min != null ? formatDuration(summary.duration_min) : "—"} />
                  <SummaryStat icon="speedometer-outline" label="Avg speed" value={summary.avg_speed_kmh != null ? `${summary.avg_speed_kmh} km/h` : "—"} />
                  <SummaryStat icon="people-outline" label="Passengers" value={summary.passengers != null ? String(summary.passengers) : "—"} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Ionicons name={icon as any} size={18} color="#1a3cff" />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a4e", marginBottom: 10 },
  verifyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1a3cff", borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0f0f5" },
  paxName: { fontSize: 14.5, fontWeight: "700", color: "#1a1a4e" },
  paxSeats: { backgroundColor: "#f0f4ff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  paxSeatsText: { fontSize: 12, fontWeight: "700", color: "#1a3cff" },
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

  mapCard: { padding: 0, overflow: "hidden" },
  map: { height: 180, width: "100%" },
  mapCaption: { fontSize: 12, color: "#888", padding: 10 },
  busMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#1a3cff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },

  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryHeaderText: { fontSize: 15, fontWeight: "700", color: "#1a1a4e" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  summaryStat: { flexBasis: "47%", backgroundColor: "#f0f4ff", borderRadius: 12, padding: 12, alignItems: "flex-start", gap: 4 },
  summaryValue: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e" },
  summaryLabel: { fontSize: 11, color: "#888" },
});
