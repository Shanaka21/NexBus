import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "./config";
import { getUserId } from "./userSession";

const ROUTES = [
  {
    id: "1",
    number: "138",
    from: "Fort",
    to: "Maharagama",
    fare: 60,
    duration: "45 mins",
  },
  {
    id: "2",
    number: "122",
    from: "Pettah",
    to: "Avissawella",
    fare: 90,
    duration: "60 mins",
  },
  {
    id: "3",
    number: "190",
    from: "Maharagama",
    to: "Meegoda",
    fare: 30,
    duration: "20 mins",
  },
];

const TIMES = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM",
  "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
];

export default function NewBookingScreen() {
  const router = useRouter();
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const totalFare = selectedRoute ? selectedRoute.fare * seats : 0;

  const handleBooking = () => {
    if (!selectedRoute) {
      Alert.alert("Error", "Please select a route");
      return;
    }
    if (!selectedTime) {
      Alert.alert("Error", "Please select a time");
      return;
    }
    Alert.alert(
      "Confirm Booking",
      `Route ${selectedRoute.number} - ${selectedRoute.to}\n${selectedTime} • ${seats} seat(s)\nTotal: LKR ${totalFare}`,
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
                Alert.alert("Success", "Booking confirmed!", [
                  { text: "OK", onPress: () => router.replace("/bookings") },
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

      {/* Header */}
      <LinearGradient
        colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Booking</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Select Route */}
        <Text style={styles.sectionTitle}>Select Route</Text>
        {ROUTES.map((route) => (
          <TouchableOpacity
            key={route.id}
            style={[
              styles.routeCard,
              selectedRoute?.id === route.id && styles.routeCardActive,
            ]}
            onPress={() => setSelectedRoute(route)}
          >
            <View style={styles.routeLeft}>
              <View
                style={[
                  styles.routeNumberBox,
                  selectedRoute?.id === route.id && styles.routeNumberBoxActive,
                ]}
              >
                <Text
                  style={[
                    styles.routeNumber,
                    selectedRoute?.id === route.id && styles.routeNumberActive,
                  ]}
                >
                  {route.number}
                </Text>
              </View>
              <View>
                <Text style={styles.routeName}>
                  {route.from} → {route.to}
                </Text>
                <View style={styles.routeMeta}>
                  <Ionicons name="time-outline" size={12} color="#888" />
                  <Text style={styles.routeMetaText}>{route.duration}</Text>
                  <Ionicons name="cash-outline" size={12} color="#888" />
                  <Text style={styles.routeMetaText}>
                    LKR {route.fare}/seat
                  </Text>
                </View>
              </View>
            </View>
            {selectedRoute?.id === route.id && (
              <Ionicons name="checkmark-circle" size={22} color="#1a3cff" />
            )}
          </TouchableOpacity>
        ))}

        {/* Select Time */}
        <Text style={styles.sectionTitle}>Select Time</Text>
        <View style={styles.timeGrid}>
          {TIMES.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeChip,
                selectedTime === time && styles.timeChipActive,
              ]}
              onPress={() => setSelectedTime(time)}
            >
              <Text
                style={[
                  styles.timeText,
                  selectedTime === time && styles.timeTextActive,
                ]}
              >
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Select Seats */}
        <Text style={styles.sectionTitle}>Number of Seats</Text>
        <View style={styles.seatsRow}>
          <TouchableOpacity
            style={styles.seatBtn}
            onPress={() => setSeats(Math.max(1, seats - 1))}
          >
            <Ionicons name="remove" size={20} color="#1a3cff" />
          </TouchableOpacity>
          <Text style={styles.seatCount}>{seats}</Text>
          <TouchableOpacity
            style={styles.seatBtn}
            onPress={() => setSeats(Math.min(6, seats + 1))}
          >
            <Ionicons name="add" size={20} color="#1a3cff" />
          </TouchableOpacity>
          <Text style={styles.seatMax}>Max 6 seats</Text>
        </View>

        {/* Summary */}
        {selectedRoute && selectedTime && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Booking Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Route</Text>
              <Text style={styles.summaryValue}>
                {selectedRoute.number} - {selectedRoute.to}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Time</Text>
              <Text style={styles.summaryValue}>{selectedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Seats</Text>
              <Text style={styles.summaryValue}>{seats}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Fare</Text>
              <Text style={styles.totalFare}>LKR {totalFare}</Text>
            </View>
          </View>
        )}

        {/* Book Button */}
        <TouchableOpacity
          onPress={handleBooking}
          style={{ marginBottom: 20 }}
          disabled={submitting}
        >
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={[styles.bookButton, submitting && { opacity: 0.6 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="ticket-outline" size={20} color="#fff" />
            <Text style={styles.bookButtonText}>
              {submitting ? "Booking..." : "Confirm Booking"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a4e",
    marginBottom: 12,
    marginTop: 8,
  },
  routeCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#eee",
  },
  routeCardActive: {
    borderColor: "#1a3cff",
    backgroundColor: "#f0f4ff",
  },
  routeLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeNumberBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumberBoxActive: { backgroundColor: "#1a3cff" },
  routeNumber: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  routeNumberActive: { color: "#fff" },
  routeName: { fontSize: 15, fontWeight: "600", color: "#1a1a4e" },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  routeMetaText: { fontSize: 12, color: "#888" },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  timeChipActive: { backgroundColor: "#1a3cff", borderColor: "#1a3cff" },
  timeText: { fontSize: 13, color: "#555" },
  timeTextActive: { color: "#fff", fontWeight: "600" },
  seatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  seatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  seatCount: { fontSize: 22, fontWeight: "bold", color: "#1a1a4e" },
  seatMax: { fontSize: 12, color: "#aaa", marginLeft: 8 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a4e",
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14, color: "#888" },
  summaryValue: { fontSize: 14, fontWeight: "600", color: "#1a1a4e" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  totalFare: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  bookButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
