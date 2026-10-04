import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../lib/api";
import { stopLabel, lkr, dayTime } from "../lib/format";

type Stop = { stopId: string; name: string; nameSi: string; sequenceNo: number };
type RouteItem = {
  id: string; route_number: string; route_name: string; start_point: string; end_point: string;
  service_type: string; base_fare_lkr: number; distance_km: number; estimated_duration_min: number; stops: Stop[];
};
type Trip = {
  id: string; status: string; scheduled_departure: number; delay_minutes: number;
  reservable_seats: number; available_seats: number; registration_no: string;
};

const TYPE_LABEL: Record<string, string> = { normal: "Ordinary", semi_luxury: "Semi-Luxury", luxury: "Luxury", expressway: "Expressway" };
const duration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} m` : ""}`.trim() : `${min} m`);

export default function NewBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ route_id?: string; trip_id?: string; from?: string; to?: string }>();

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [boardingId, setBoardingId] = useState<string | null>(null);
  const [alightingId, setAlightingId] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiJson("/routes")
      .then(({ ok, data }) => {
        if (!ok || !Array.isArray(data)) return;
        const list = (data as RouteItem[]).filter((r) => r.stops?.length >= 2);
        setRoutes(list);
        if (params.route_id) {
          const preset = list.find((r) => r.id === params.route_id);
          if (preset) setSelectedRoute(preset);
        }
      })
      .catch(() => Alert.alert("Error", "Could not load routes."))
      .finally(() => setLoadingRoutes(false));
  }, [params.route_id]);

  // Upcoming trips that take reservations on the selected route
  useEffect(() => {
    if (!selectedRoute) return;
    setLoadingTrips(true);
    setSelectedTrip(null);
    apiJson(`/trips?route_id=${selectedRoute.id}`)
      .then(({ ok, data }) => {
        if (!ok || !Array.isArray(data)) { setTrips([]); return; }
        const open = (data as Trip[]).filter(
          (t) => t.reservable_seats > 0 &&
            (t.status === "running" || t.scheduled_departure > Date.now() - 10 * 60 * 1000)
        );
        setTrips(open);
        const preset = params.trip_id ? open.find((t) => t.id === params.trip_id) : null;
        if (preset) setSelectedTrip(preset);
      })
      .catch(() => setTrips([]))
      .finally(() => setLoadingTrips(false));

    const ids = selectedRoute.stops.map((s) => s.stopId);
    setBoardingId(params.from && ids.includes(params.from) ? params.from : ids[0]);
    setAlightingId(params.to && ids.includes(params.to) ? params.to : ids[ids.length - 1]);
    setSeats(1);
  }, [selectedRoute, params.trip_id, params.from, params.to]);

  const stops = selectedRoute?.stops ?? [];
  const boardingIndex = stops.findIndex((s) => s.stopId === boardingId);
  const alightingIndex = stops.findIndex((s) => s.stopId === alightingId);
  const maxSeats = selectedTrip ? Math.max(1, Math.min(4, selectedTrip.available_seats)) : 4;
  const totalFare = selectedRoute ? selectedRoute.base_fare_lkr * seats : 0;

  const chooseBoarding = (id: string) => {
    const index = stops.findIndex((s) => s.stopId === id);
    setBoardingId(id);
    if (alightingIndex <= index) setAlightingId(stops[Math.min(index + 1, stops.length - 1)].stopId);
  };

  const canBook = !!selectedRoute && !!selectedTrip && boardingIndex >= 0 && alightingIndex > boardingIndex && selectedTrip.available_seats > 0;

  const handleBooking = async () => {
    if (!canBook || !selectedTrip || !boardingId || !alightingId) return;
    setSubmitting(true);
    try {
      const { ok, status, data } = await apiJson("/bookings", {
        method: "POST",
        ...jsonBody({ trip_id: selectedTrip.id, boarding_stop_id: boardingId, alighting_stop_id: alightingId, seat_count: seats }),
      });
      if (ok && data?.id) {
        router.replace({ pathname: "/payment", params: { id: data.id } } as any);
      } else if (status === 409 && data?.code === "SEATS_UNAVAILABLE") {
        Alert.alert("Not enough seats", "Someone just took those seats. Plan Trip can suggest other buses.", [
          { text: "Close", style: "cancel" },
          { text: "Plan Trip", onPress: () => router.push({ pathname: "/smartsuggestions", params: { from: boardingId, to: alightingId, need_seat: "1" } } as any) },
        ]);
      } else {
        Alert.alert("Booking failed", data?.error || "Please try again.");
      }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => ({
    intercity: routes.filter((r) => r.distance_km >= 40),
    urban: routes.filter((r) => r.distance_km < 40),
  }), [routes]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>1. Select Route</Text>
        {loadingRoutes && <ActivityIndicator color="#1a3cff" style={{ marginVertical: 16 }} />}
        {grouped.intercity.length > 0 && <Text style={styles.groupLabel}>INTERCITY</Text>}
        {grouped.intercity.map((r) => (
          <RouteCard key={r.id} route={r} selected={selectedRoute?.id === r.id} onPress={() => setSelectedRoute(r)} />
        ))}
        {grouped.urban.length > 0 && <Text style={styles.groupLabel}>URBAN / SUBURBAN</Text>}
        {grouped.urban.map((r) => (
          <RouteCard key={r.id} route={r} selected={selectedRoute?.id === r.id} onPress={() => setSelectedRoute(r)} />
        ))}

        {selectedRoute && (
          <>
            <Text style={styles.sectionTitle}>2. Select Trip</Text>
            {loadingTrips && <ActivityIndicator color="#1a3cff" style={{ marginVertical: 16 }} />}
            {!loadingTrips && trips.length === 0 && (
              <Text style={styles.hint}>No trips with reservable seats are open on this route right now.</Text>
            )}
            {trips.map((t) => {
              const full = t.available_seats === 0;
              const active = selectedTrip?.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  disabled={full}
                  style={[styles.tripCard, active && styles.routeCardActive, full && { opacity: 0.5 }]}
                  onPress={() => { setSelectedTrip(t); setSeats(1); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripTime}>{t.status === "running" ? "On the way" : dayTime(t.scheduled_departure)}</Text>
                    <Text style={styles.routeMetaText}>
                      Bus {t.registration_no}{t.delay_minutes >= 10 ? ` · ${t.delay_minutes} min late` : ""}
                    </Text>
                  </View>
                  <View style={[styles.seatPill, full && { backgroundColor: "#ffebee" }]}>
                    <Text style={[styles.seatPillText, full && { color: "#f44336" }]}>
                      {full ? "FULL" : `${t.available_seats} / ${t.reservable_seats} seats`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.sectionTitle}>3. Boarding and Alighting Stops</Text>
            <Text style={styles.groupLabel}>BOARDING</Text>
            <View style={styles.timeGrid}>
              {stops.slice(0, -1).map((s) => (
                <TouchableOpacity key={s.stopId} style={[styles.timeChip, boardingId === s.stopId && styles.timeChipActive]} onPress={() => chooseBoarding(s.stopId)}>
                  <Text style={[styles.timeText, boardingId === s.stopId && styles.timeTextActive]}>{stopLabel(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.groupLabel}>ALIGHTING</Text>
            <View style={styles.timeGrid}>
              {stops.map((s, index) => {
                const disabled = index <= boardingIndex; // an alighting stop before the boarding stop cannot be chosen
                return (
                  <TouchableOpacity
                    key={s.stopId}
                    disabled={disabled}
                    style={[styles.timeChip, alightingId === s.stopId && styles.timeChipActive, disabled && { opacity: 0.35 }]}
                    onPress={() => setAlightingId(s.stopId)}
                  >
                    <Text style={[styles.timeText, alightingId === s.stopId && styles.timeTextActive]}>{stopLabel(s)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>4. Number of Seats</Text>
            <View style={styles.seatsRow}>
              <TouchableOpacity style={styles.seatBtn} onPress={() => setSeats(Math.max(1, seats - 1))}>
                <Ionicons name="remove" size={20} color="#1a3cff" />
              </TouchableOpacity>
              <Text style={styles.seatCount}>{seats}</Text>
              <TouchableOpacity style={styles.seatBtn} onPress={() => setSeats(Math.min(maxSeats, seats + 1))}>
                <Ionicons name="add" size={20} color="#1a3cff" />
              </TouchableOpacity>
              <Text style={styles.seatMax}>Max {maxSeats} seat{maxSeats === 1 ? "" : "s"}</Text>
            </View>
          </>
        )}

        {canBook && selectedRoute && selectedTrip && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Summary</Text>
            <SummaryRow label="Route" value={`${selectedRoute.route_number} · ${selectedRoute.start_point} → ${selectedRoute.end_point}`} />
            <SummaryRow label="Departure" value={selectedTrip.status === "running" ? "On the way" : dayTime(selectedTrip.scheduled_departure)} />
            <SummaryRow label="Boarding" value={stopLabel(stops[boardingIndex])} />
            <SummaryRow label="Alighting" value={stopLabel(stops[alightingIndex])} />
            <SummaryRow label="Seats" value={String(seats)} />
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fare per Seat</Text>
              <Text style={styles.summaryValue}>{lkr(selectedRoute.base_fare_lkr)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontWeight: "700", color: "#1a1a4e" }]}>Total Fare</Text>
              <Text style={styles.totalFare}>{lkr(totalFare)}</Text>
            </View>
            <Text style={styles.hint}>Seats are held for 10 minutes while you pay.</Text>
          </View>
        )}

        <TouchableOpacity onPress={handleBooking} style={{ marginBottom: 20 }} disabled={submitting || !canBook}>
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={[styles.bookButton, (submitting || !canBook) && { opacity: 0.5 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="card-outline" size={20} color="#fff" />
            <Text style={styles.bookButtonText}>{submitting ? "Booking…" : "Book & Pay"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function RouteCard({ route, selected, onPress }: { route: RouteItem; selected: boolean; onPress: () => void }) {
  const isLux = route.service_type !== "normal";
  return (
    <TouchableOpacity style={[styles.routeCard, selected && styles.routeCardActive]} onPress={onPress}>
      <View style={[styles.routeNumberBox, selected && styles.routeNumberBoxActive]}>
        <Text style={[styles.routeNumber, selected && styles.routeNumberActive]}>{route.route_number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.routeNameRow}>
          <Text style={styles.routeName}>{route.start_point} → {route.end_point}</Text>
          <View style={[styles.typeBadge, isLux && styles.typeBadgeLux]}>
            <Text style={[styles.typeBadgeText, isLux && styles.typeBadgeTextLux]}>{TYPE_LABEL[route.service_type] || route.service_type}</Text>
          </View>
        </View>
        <View style={styles.routeMeta}>
          <Ionicons name="time-outline" size={12} color="#888" />
          <Text style={styles.routeMetaText}>{duration(route.estimated_duration_min)}</Text>
          <Text style={styles.routeMetaDot}>·</Text>
          <Text style={styles.routeMetaText}>{Math.round(route.distance_km)} km</Text>
          <Text style={styles.routeMetaDot}>·</Text>
          <Text style={[styles.fareText, isLux && { color: "#f5a623" }]}>{lkr(route.base_fare_lkr)}/seat</Text>
        </View>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={22} color="#1a3cff" style={{ marginLeft: 8 }} />}
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20 },

  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e", marginBottom: 6, marginTop: 14 },
  groupLabel: { fontSize: 11, fontWeight: "700", color: "#aaa", letterSpacing: 1, marginBottom: 8, marginTop: 4, marginLeft: 2 },
  hint: { fontSize: 12, color: "#888", marginBottom: 8, marginTop: 4 },

  routeCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#eee",
  },
  routeCardActive: { borderColor: "#1a3cff", backgroundColor: "#f0f4ff" },
  routeNumberBox: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: "#f0f4ff",
    alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0,
  },
  routeNumberBoxActive: { backgroundColor: "#1a3cff" },
  routeNumber: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  routeNumberActive: { color: "#fff" },
  routeNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  routeName: { fontSize: 14, fontWeight: "600", color: "#1a1a4e" },
  typeBadge: { backgroundColor: "#f0f4ff", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeLux: { backgroundColor: "#fff8e1" },
  typeBadgeText: { fontSize: 10, fontWeight: "700", color: "#1a3cff" },
  typeBadgeTextLux: { color: "#f5a623" },
  routeMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  routeMetaText: { fontSize: 12, color: "#888" },
  routeMetaDot: { fontSize: 12, color: "#ccc" },
  fareText: { fontSize: 12, fontWeight: "700", color: "#1a3cff" },

  tripCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#eee",
  },
  tripTime: { fontSize: 15, fontWeight: "700", color: "#1a1a4e", marginBottom: 2 },
  seatPill: { backgroundColor: "#e8f5e9", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  seatPillText: { fontSize: 12, fontWeight: "700", color: "#4caf50" },

  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee" },
  timeChipActive: { backgroundColor: "#1a3cff", borderColor: "#1a3cff" },
  timeText: { fontSize: 13, color: "#555" },
  timeTextActive: { color: "#fff", fontWeight: "600" },

  seatsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 16, marginBottom: 16 },
  seatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center" },
  seatCount: { fontSize: 22, fontWeight: "bold", color: "#1a1a4e" },
  seatMax: { fontSize: 12, color: "#aaa", marginLeft: 8 },

  summaryCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: "bold", color: "#1a1a4e", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: "#888" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1a1a4e", textAlign: "right", flex: 1, marginLeft: 8 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  totalFare: { fontSize: 17, fontWeight: "bold", color: "#1a3cff" },

  bookButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 10 },
  bookButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
