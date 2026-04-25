import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "./config";
import { getUserId } from "./userSession";

// Fares based on NTC ordinary bus tariff 2024/2025 (~LKR 2.60/km)
// Semi-luxury ~40% above ordinary
const ROUTES = [
  // ── Intercity ──
  { id: "r01",  number: "01",  from: "Fort",       to: "Kandy",       fare: 300, duration: "3 h 30 m", type: "Ordinary",    km: 116 },
  { id: "r48",  number: "48",  from: "Fort",       to: "Kandy",       fare: 420, duration: "3 h",      type: "Semi-Luxury", km: 116 },
  { id: "r17",  number: "17",  from: "Panadura",   to: "Kandy",       fare: 350, duration: "4 h",      type: "Ordinary",    km: 135 },
  { id: "r05",  number: "05",  from: "Fort",       to: "Kurunegala",  fare: 245, duration: "2 h 30 m", type: "Ordinary",    km: 94  },
  { id: "r100", number: "100", from: "Fort",       to: "Kurunegala",  fare: 340, duration: "2 h 15 m", type: "Semi-Luxury", km: 94  },
  { id: "r400", number: "400", from: "Fort",       to: "Negombo",     fare: 130, duration: "1 h 15 m", type: "Ordinary",    km: 50  },
  { id: "r122", number: "122", from: "Pettah",     to: "Avissawella", fare: 145, duration: "1 h 30 m", type: "Ordinary",    km: 55  },
  // ── Urban / Suburban ──
  { id: "r138", number: "138", from: "Fort",       to: "Maharagama",  fare: 60,  duration: "45 m",     type: "Ordinary",    km: 18  },
  { id: "r187", number: "187", from: "Fort",       to: "Battaramulla",fare: 45,  duration: "35 m",     type: "Ordinary",    km: 15  },
  { id: "r06",  number: "06",  from: "Fort",       to: "Dehiwala",    fare: 35,  duration: "30 m",     type: "Ordinary",    km: 12  },
  { id: "r14",  number: "14",  from: "Pettah",     to: "Kelaniya",    fare: 30,  duration: "25 m",     type: "Ordinary",    km: 10  },
  { id: "r190", number: "190", from: "Maharagama", to: "Meegoda",     fare: 50,  duration: "25 m",     type: "Ordinary",    km: 16  },
];

const INTERCITY = ROUTES.filter((r) => r.km >= 40);
const URBAN     = ROUTES.filter((r) => r.km < 40);

const TIMES = [
  "05:30 AM", "06:00 AM", "06:30 AM", "07:00 AM",
  "07:30 AM", "08:00 AM", "09:00 AM", "10:00 AM",
  "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
  "07:00 PM", "08:00 PM",
];

export default function NewBookingScreen() {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedTime, setSelectedTime]   = useState<string | null>(null);
  const [seats, setSeats]       = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const totalFare = selectedRoute ? selectedRoute.fare * seats : 0;

  const handleBooking = () => {
    if (!selectedRoute) { Alert.alert("Error", "Please select a route"); return; }
    if (!selectedTime)  { Alert.alert("Error", "Please select a time");  return; }
    Alert.alert(
      "Confirm Booking",
      `Route ${selectedRoute.number} · ${selectedRoute.from} → ${selectedRoute.to}\n${selectedTime} · ${seats} seat(s)\nTotal: LKR ${totalFare}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSubmitting(true);
            try {
              const uid = getUserId();
              const res = await fetch(`${API_URL}/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_id: uid || "guest",
                  route_number: selectedRoute.number,
                  from: selectedRoute.from,
                  to: selectedRoute.to,
                  time: selectedTime,
                  seats,
                  fare: `LKR ${totalFare}`,
                }),
              });
              const data = await res.json();
              if (data.id) {
                Alert.alert("Booking Confirmed!", `Your ticket for Route ${selectedRoute.number} has been booked.`, [
                  { text: "View Bookings", onPress: () => router.replace("/bookings") },
                ]);
              } else {
                Alert.alert("Error", "Booking failed. Try again.");
              }
            } catch {
              Alert.alert("Error", "Could not connect to server.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

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

        {/* ── Intercity Routes ── */}
        <Text style={styles.sectionTitle}>Select Route</Text>
        <Text style={styles.groupLabel}>INTERCITY</Text>
        {INTERCITY.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            selected={selectedRoute?.id === route.id}
            onPress={() => setSelectedRoute(route)}
          />
        ))}

        {/* ── Urban Routes ── */}
        <Text style={styles.groupLabel}>URBAN / SUBURBAN</Text>
        {URBAN.map((route) => (
          <RouteCard
            key={route.id}
            route={route}
            selected={selectedRoute?.id === route.id}
            onPress={() => setSelectedRoute(route)}
          />
        ))}

        {/* ── Select Time ── */}
        <Text style={styles.sectionTitle}>Departure Time</Text>
        <View style={styles.timeGrid}>
          {TIMES.map((time) => (
            <TouchableOpacity
              key={time}
              style={[styles.timeChip, selectedTime === time && styles.timeChipActive]}
              onPress={() => setSelectedTime(time)}
            >
              <Text style={[styles.timeText, selectedTime === time && styles.timeTextActive]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Select Seats ── */}
        <Text style={styles.sectionTitle}>Number of Seats</Text>
        <View style={styles.seatsRow}>
          <TouchableOpacity style={styles.seatBtn} onPress={() => setSeats(Math.max(1, seats - 1))}>
            <Ionicons name="remove" size={20} color="#1a3cff" />
          </TouchableOpacity>
          <Text style={styles.seatCount}>{seats}</Text>
          <TouchableOpacity style={styles.seatBtn} onPress={() => setSeats(Math.min(6, seats + 1))}>
            <Ionicons name="add" size={20} color="#1a3cff" />
          </TouchableOpacity>
          <Text style={styles.seatMax}>Max 6 seats</Text>
        </View>

        {/* ── Summary ── */}
        {selectedRoute && selectedTime && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Summary</Text>
            <SummaryRow label="Route"      value={`${selectedRoute.number} · ${selectedRoute.from} → ${selectedRoute.to}`} />
            <SummaryRow label="Type"       value={selectedRoute.type} />
            <SummaryRow label="Distance"   value={`${selectedRoute.km} km`} />
            <SummaryRow label="Duration"   value={selectedRoute.duration} />
            <SummaryRow label="Departure"  value={selectedTime} />
            <SummaryRow label="Seats"      value={String(seats)} />
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fare per Seat</Text>
              <Text style={styles.summaryValue}>LKR {selectedRoute.fare}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontWeight: "700", color: "#1a1a4e" }]}>Total Fare</Text>
              <Text style={styles.totalFare}>LKR {totalFare}</Text>
            </View>
          </View>
        )}

        {/* ── Book Button ── */}
        <TouchableOpacity onPress={handleBooking} style={{ marginBottom: 20 }} disabled={submitting}>
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={[styles.bookButton, submitting && { opacity: 0.6 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={styles.bookButtonText}>
              {submitting ? "Booking…" : "Confirm Booking"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function RouteCard({ route, selected, onPress }: { route: any; selected: boolean; onPress: () => void }) {
  const isLux = route.type === "Semi-Luxury";
  return (
    <TouchableOpacity
      style={[styles.routeCard, selected && styles.routeCardActive]}
      onPress={onPress}
    >
      <View style={[styles.routeNumberBox, selected && styles.routeNumberBoxActive]}>
        <Text style={[styles.routeNumber, selected && styles.routeNumberActive]}>
          {route.number}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.routeNameRow}>
          <Text style={styles.routeName}>{route.from} → {route.to}</Text>
          <View style={[styles.typeBadge, isLux && styles.typeBadgeLux]}>
            <Text style={[styles.typeBadgeText, isLux && styles.typeBadgeTextLux]}>{route.type}</Text>
          </View>
        </View>
        <View style={styles.routeMeta}>
          <Ionicons name="time-outline" size={12} color="#888" />
          <Text style={styles.routeMetaText}>{route.duration}</Text>
          <Text style={styles.routeMetaDot}>·</Text>
          <Text style={styles.routeMetaText}>{route.km} km</Text>
          <Text style={styles.routeMetaDot}>·</Text>
          <Text style={[styles.fareText, isLux && { color: "#f5a623" }]}>LKR {route.fare}/seat</Text>
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

  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e", marginBottom: 6, marginTop: 8 },
  groupLabel: {
    fontSize: 11, fontWeight: "700", color: "#aaa",
    letterSpacing: 1, marginBottom: 8, marginTop: 4, marginLeft: 2,
  },

  routeCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#eee",
  },
  routeCardActive: { borderColor: "#1a3cff", backgroundColor: "#f0f4ff" },
  routeNumberBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center",
    marginRight: 12, flexShrink: 0,
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

  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee",
  },
  timeChipActive: { backgroundColor: "#1a3cff", borderColor: "#1a3cff" },
  timeText: { fontSize: 13, color: "#555" },
  timeTextActive: { color: "#fff", fontWeight: "600" },

  seatsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14, padding: 16, gap: 16, marginBottom: 16,
  },
  seatBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center",
  },
  seatCount: { fontSize: 22, fontWeight: "bold", color: "#1a1a4e" },
  seatMax: { fontSize: 12, color: "#aaa", marginLeft: 8 },

  summaryCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryTitle: { fontSize: 15, fontWeight: "bold", color: "#1a1a4e", marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: "#888" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1a1a4e", textAlign: "right", flex: 1, marginLeft: 8 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  totalFare: { fontSize: 17, fontWeight: "bold", color: "#1a3cff" },

  bookButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 16, gap: 10,
  },
  bookButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
