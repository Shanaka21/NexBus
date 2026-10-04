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
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson } from "../lib/api";
import { useTheme } from "../lib/themeContext";

type Booking = {
  id: string;
  booking_reference: string | null;
  route: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  status: string;
  fare: string;
  payment_status: string;
  hold_expires_at: number | null;
  refund_required: boolean;
};

const statusColors: any = {
  pending_payment: { bg: "#fff3e0", text: "#ff9800" },
  confirmed: { bg: "#e8f5e9", text: "#4caf50" },
  completed: { bg: "#e3f2fd", text: "#1a3cff" },
  cancelled: { bg: "#ffebee", text: "#f44336" },
  expired: { bg: "#eeeeee", text: "#9e9e9e" },
};

const statusLabel = (s: string) =>
  s === "pending_payment" ? "Awaiting payment" : s.charAt(0).toUpperCase() + s.slice(1);

const light = {
  bg:          "#f0f0f5",
  card:        "#fff",
  text:        "#1a1a4e",
  subText:     "#888",
  statsRow:    "#fff",
  statDivider: "#eee",
  tab:         "#fff",
  routeBadge:  "#f0f4ff",
  routeLine:   "#eee",
  bottomNav:   "#fff",
  bottomNavBorder: "#eee",
};

const dark = {
  bg:          "#0d0d1a",
  card:        "#1a1a2e",
  text:        "#dde0ff",
  subText:     "#888",
  statsRow:    "#1a1a2e",
  statDivider: "#2a2a4e",
  tab:         "#1a1a2e",
  routeBadge:  "#1e2250",
  routeLine:   "#2a2a4e",
  bottomNav:   "#1a1a2e",
  bottomNavBorder: "#2a2a4e",
};

export default function BookingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [activeTab, setActiveTab] = useState("All");
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const tabs = ["All", "Pending", "Confirmed", "Completed", "Cancelled"];

  const fetchBookings = async () => {
    try {
      const { ok, data } = await apiJson("/bookings/me");
      if (ok && Array.isArray(data)) setBookings(data);
      else Alert.alert("Error", data?.error || "Could not load bookings.");
    } catch {
      Alert.alert("Error", "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchBookings(); }, []));

  const matchesTab = (b: Booking) =>
    activeTab === "All" ||
    (activeTab === "Pending" ? b.status === "pending_payment" : b.status === activeTab.toLowerCase());
  const filtered = bookings.filter(matchesTab);

  const handleCancel = (id: string, paid: boolean) => {
    Alert.alert(
      "Cancel Booking",
      paid ? "Your payment will be refunded by the operator. Cancel this booking?" : "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel", style: "destructive",
          onPress: async () => {
            try {
              const { ok, data } = await apiJson(`/bookings/${id}/cancel`, { method: "PATCH" });
              if (!ok) { Alert.alert("Error", data?.error || "Could not cancel booking."); return; }
              setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled", refund_required: !!data.refund_required } : b));
              Alert.alert("Cancelled", data.refund_required ? "Your booking has been cancelled. The operator will process your refund." : "Your booking has been cancelled.");
            } catch {
              Alert.alert("Error", "Could not cancel booking.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {/* Stats Row */}
      <View style={[styles.statsRow, { backgroundColor: p.statsRow }]}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: p.text }]}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: p.statDivider }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#4caf50" }]}>{bookings.filter((b) => b.status === "confirmed").length}</Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: p.statDivider }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#1a3cff" }]}>{bookings.filter((b) => b.status === "completed").length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: p.statDivider }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: "#f44336" }]}>{bookings.filter((b) => b.status === "cancelled").length}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, { backgroundColor: p.tab }, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
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
          ListEmptyComponent={<EmptyState router={router} palette={p} />}
          renderItem={({ item }) => (
            <View style={[styles.bookingCard, { backgroundColor: p.card }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.routeBadge, { backgroundColor: p.routeBadge }]}>
                  <Text style={styles.routeNumber}>{item.route}</Text>
                </View>
                {item.booking_reference ? <Text style={styles.reference}>{item.booking_reference}</Text> : null}
                <View style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] || statusColors.confirmed).bg }]}>
                  <Text style={[styles.statusText, { color: (statusColors[item.status] || statusColors.confirmed).text }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.routeRow}>
                <View style={styles.routePoint}>
                  <View style={styles.dotBlue} />
                  <Text style={[styles.routeText, { color: p.text }]}>{item.from}</Text>
                </View>
                <View style={[styles.routeLine, { backgroundColor: p.routeLine }]} />
                <View style={styles.routePoint}>
                  <View style={styles.dotGray} />
                  <Text style={[styles.routeText, { color: p.text }]}>{item.to}</Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}><Ionicons name="calendar-outline" size={14} color="#888" /><Text style={styles.detailText}>{item.date}</Text></View>
                <View style={styles.detailItem}><Ionicons name="time-outline"     size={14} color="#888" /><Text style={styles.detailText}>{item.time}</Text></View>
                <View style={styles.detailItem}><Ionicons name="people-outline"   size={14} color="#888" /><Text style={styles.detailText}>{item.seats} seats</Text></View>
                <View style={styles.detailItem}><Ionicons name="cash-outline"     size={14} color="#888" /><Text style={styles.detailText}>{item.fare}</Text></View>
              </View>

              {item.refund_required && (
                <Text style={styles.refundNote}>Refund pending: the operator will process it manually.</Text>
              )}

              {item.status === "pending_payment" && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.trackBtn} onPress={() => router.push({ pathname: "/payment", params: { id: item.id } } as any)}>
                    <Ionicons name="card-outline" size={14} color="#fff" />
                    <Text style={styles.trackBtnText}>Pay now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id, false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {item.status === "confirmed" && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.trackBtn} onPress={() => router.push("/map")}>
                    <Ionicons name="location-outline" size={14} color="#fff" />
                    <Text style={styles.trackBtnText}>Track Bus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id, item.payment_status === "success")}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.bookRideBtn} onPress={() => router.push("/newbooking" as any)}>
        <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.bookRideGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="bus-outline" size={20} color="#fff" />
          <Text style={styles.bookRideText}>Book a Ride</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: p.bottomNav, borderTopColor: p.bottomNavBorder }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/map")}>
          <Ionicons name="map-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="ticket" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({ router, palette }: { router: any; palette: typeof light }) {
  return (
    <ScrollView contentContainerStyle={emptyStyles.wrap} scrollEnabled={false}>
      <Ionicons name="ticket-outline" size={48} color="#ccc" />
      <Text style={[emptyStyles.title, { color: palette.text }]}>No Bookings Yet</Text>
      <Text style={emptyStyles.sub}>Reserve a seat on a trip, pay securely online and track your bus live.</Text>
      <TouchableOpacity style={[emptyStyles.bookBtn, { backgroundColor: palette.routeBadge }]} onPress={() => router.push("/newbooking")}>
        <Text style={emptyStyles.bookBtnText}>Book a seat</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const emptyStyles = StyleSheet.create({
  wrap:         { paddingHorizontal: 16, paddingTop: 40, paddingBottom: 40, alignItems: "center" },
  title:        { fontSize: 18, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  sub:          { fontSize: 13, color: "#aaa", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  bookBtn:      { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28, alignItems: "center", borderWidth: 1, borderColor: "#d0d8ff" },
  bookBtnText:  { fontSize: 14, fontWeight: "700", color: "#1a3cff" },
});

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },

  statsRow:    { flexDirection: "row", paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12 },
  statBox:     { flex: 1, alignItems: "center" },
  statNumber:  { fontSize: 22, fontWeight: "bold" },
  statLabel:   { fontSize: 11, color: "#888", marginTop: 2 },
  statDivider: { width: 1 },

  tabRow:       { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  tab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabActive:    { backgroundColor: "#1a3cff" },
  tabText:      { fontSize: 13, color: "#888" },
  tabTextActive:{ color: "#fff", fontWeight: "600" },

  list: { paddingHorizontal: 16, paddingBottom: 160 },

  bookingCard: { borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  routeBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  routeNumber: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 12, fontWeight: "600" },
  reference:   { fontSize: 12, color: "#888", letterSpacing: 1, flex: 1, textAlign: "center" },
  refundNote:  { fontSize: 12, color: "#ff9800", marginBottom: 10 },

  routeRow:   { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  routePoint: { flexDirection: "row", alignItems: "center", gap: 6 },
  dotBlue:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1a3cff" },
  dotGray:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#888" },
  routeLine:  { flex: 1, height: 1 },
  routeText:  { fontSize: 14, fontWeight: "600" },

  detailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { fontSize: 12, color: "#888" },

  actionsRow:    { flexDirection: "row", gap: 10 },
  trackBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#1a3cff", borderRadius: 10, paddingVertical: 10, gap: 6 },
  trackBtnText:  { color: "#fff", fontSize: 13, fontWeight: "600" },
  cancelBtn:     { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffebee", borderRadius: 10, paddingVertical: 10 },
  cancelBtnText: { color: "#f44336", fontSize: 13, fontWeight: "600" },

  bookRideBtn:     { position: "absolute", bottom: 80, left: 16, right: 16, borderRadius: 14, shadowColor: "#1a3cff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  bookRideGradient:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 10 },
  bookRideText:    { color: "#fff", fontSize: 16, fontWeight: "bold" },

  bottomNav:  { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10, paddingBottom: 24 },
  navItem:    { flex: 1, alignItems: "center", gap: 3 },
  navText:    { fontSize: 11 },
});
