import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "./config";
import { getUserId } from "./userSession";

type Booking = {
  id: string;
  route: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  status: string;
  fare: string;
};

const statusColors: any = {
  confirmed: { bg: "#e8f5e9", text: "#4caf50" },
  completed: { bg: "#e3f2fd", text: "#1a3cff" },
  cancelled: { bg: "#ffebee", text: "#f44336" },
};

export default function BookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const tabs = ["All", "Confirmed", "Completed", "Cancelled"];

  const fetchBookings = async () => {
    const uid = getUserId();
    const url = uid
      ? `${API_URL}/bookings?user_id=${uid}`
      : `${API_URL}/bookings`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setBookings(data);
    } catch {
      Alert.alert("Error", "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBookings();
    }, [])
  );

  const filtered = bookings.filter((b) => {
    if (activeTab === "All") return true;
    return b.status === activeTab.toLowerCase();
  });

  const handleCancel = (id: string) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${API_URL}/bookings/${id}/cancel`, { method: "PUT" });
              setBookings((prev) =>
                prev.map((b) =>
                  b.id === id ? { ...b, status: "cancelled" } : b
                )
              );
              Alert.alert("Cancelled", "Your booking has been cancelled.");
            } catch {
              Alert.alert("Error", "Could not cancel booking.");
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
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#4caf50" }]}>
            {bookings.filter((b) => b.status === "confirmed").length}
          </Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#1a3cff" }]}>
            {bookings.filter((b) => b.status === "completed").length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#f44336" }]}>
            {bookings.filter((b) => b.status === "cancelled").length}
          </Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No bookings found.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                <View style={styles.routeBadge}>
                  <Text style={styles.routeNumber}>{item.route}</Text>
                </View>
                <View style={[styles.statusBadge,
                  { backgroundColor: (statusColors[item.status] || statusColors.confirmed).bg }]}>
                  <Text style={[styles.statusText,
                    { color: (statusColors[item.status] || statusColors.confirmed).text }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routePoint}>
                  <View style={styles.dotBlue} />
                  <Text style={styles.routeText}>{item.from}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={styles.dotGray} />
                  <Text style={styles.routeText}>{item.to}</Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.date}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.time}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="people-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.seats} seats</Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={14} color="#888" />
                  <Text style={styles.detailText}>{item.fare}</Text>
                </View>
              </View>

              {item.status === "confirmed" && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.trackBtn}
                    onPress={() => router.push("/map")}
                  >
                    <Ionicons name="location-outline" size={14} color="#fff" />
                    <Text style={styles.trackBtnText}>Track Bus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(item.id)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Book a Ride Button */}
      <TouchableOpacity
        style={styles.bookRideBtn}
        onPress={() => router.push("/newbooking" as any)}
      >
        <LinearGradient
          colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
          style={styles.bookRideGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="bus-outline" size={20} color="#fff" />
          <Text style={styles.bookRideText}>Book a Ride</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color="#888" />
          <Text style={styles.navText}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/map")}>
          <Ionicons name="map-outline" size={22} color="#888" />
          <Text style={styles.navText}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="ticket" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Bookings</Text>
        </TouchableOpacity>
      </View>
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
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  statBox: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "bold", color: "#1a1a4e" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#eee" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: "#1a3cff" },
  tabText: { fontSize: 13, color: "#888" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 160 },
  emptyText: { textAlign: "center", color: "#aaa", marginTop: 40, fontSize: 15 },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  routeBadge: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  routeNumber: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  routePoint: { flexDirection: "row", alignItems: "center", gap: 6 },
  dotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1a3cff" },
  dotGray: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#888" },
  routeLine: { flex: 1, height: 1, backgroundColor: "#eee" },
  routeText: { fontSize: 14, fontWeight: "600", color: "#1a1a4e" },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, color: "#888" },
  actionsRow: { flexDirection: "row", gap: 10 },
  trackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a3cff",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  trackBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffebee",
    borderRadius: 10,
    paddingVertical: 10,
  },
  cancelBtnText: { color: "#f44336", fontSize: 13, fontWeight: "600" },
  bookRideBtn: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    borderRadius: 14,
    shadowColor: "#1a3cff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  bookRideGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  bookRideText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 10,
    paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText: { fontSize: 11, color: "#888" },
});
