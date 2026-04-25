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
import { API_URL } from "./config";
import { getUserId } from "./userSession";
import { useTheme } from "./themeContext";

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

const FEATURED_ROUTES = [
  { number: "48", from: "Fort",     to: "Kandy",      fare: 420, km: 116, duration: "3 h",      type: "Semi-Luxury", stops: "Fort · Kelaniya · Kegalle · Kadugannawa · Kandy" },
  { number: "17", from: "Panadura", to: "Kandy",      fare: 350, km: 135, duration: "4 h",      type: "Ordinary",    stops: "Panadura · Nugegoda · Kohuwala · Peradeniya · Kandy" },
  { number: "05", from: "Fort",     to: "Kurunegala", fare: 245, km: 94,  duration: "2 h 30 m", type: "Ordinary",    stops: "Fort · Gampaha · Veyangoda · Nittambuwa · Kurunegala" },
];

export default function BookingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [activeTab, setActiveTab] = useState("All");
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const tabs = ["All", "Confirmed", "Completed", "Cancelled"];

  const fetchBookings = async () => {
    const uid = getUserId();
    const url = uid ? `${API_URL}/bookings?user_id=${uid}` : `${API_URL}/bookings`;
    try {
      const res  = await fetch(url);
      const data = await res.json();
      setBookings(data);
    } catch {
      Alert.alert("Error", "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchBookings(); }, []));

  const filtered = bookings.filter((b) => activeTab === "All" || b.status === activeTab.toLowerCase());

  const handleCancel = (id: string) => {
    Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_URL}/bookings/${id}/cancel`, { method: "PUT" });
            setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled" } : b));
            Alert.alert("Cancelled", "Your booking has been cancelled.");
          } catch {
            Alert.alert("Error", "Could not cancel booking.");
          }
        },
      },
    ]);
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
          ListEmptyComponent={<EmptyState uid={getUserId()} onSeeded={fetchBookings} router={router} palette={p} />}
          renderItem={({ item }) => (
            <View style={[styles.bookingCard, { backgroundColor: p.card }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.routeBadge, { backgroundColor: p.routeBadge }]}>
                  <Text style={styles.routeNumber}>{item.route}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] || statusColors.confirmed).bg }]}>
                  <Text style={[styles.statusText, { color: (statusColors[item.status] || statusColors.confirmed).text }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
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

              {item.status === "confirmed" && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.trackBtn} onPress={() => router.push("/map")}>
                    <Ionicons name="location-outline" size={14} color="#fff" />
                    <Text style={styles.trackBtnText}>Track Bus</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
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

function EmptyState({ uid, onSeeded, router, palette }: { uid: string | null; onSeeded: () => void; router: any; palette: typeof light }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    if (!uid) { Alert.alert("Not logged in", "Please log in to load demo bookings."); return; }
    setSeeding(true);
    try {
      const res  = await fetch(`${API_URL}/bookings/seed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: uid }) });
      const data = await res.json();
      if (res.ok) { onSeeded(); }
      else { Alert.alert("Error", data.error || "Failed to load demo bookings."); }
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={emptyStyles.wrap} scrollEnabled={false}>
      <Ionicons name="ticket-outline" size={48} color="#ccc" />
      <Text style={[emptyStyles.title, { color: palette.text }]}>No Bookings Yet</Text>
      <Text style={emptyStyles.sub}>Book a seat on one of Sri Lanka&apos;s most popular routes</Text>

      {FEATURED_ROUTES.map((r) => (
        <View key={r.number} style={[emptyStyles.routeCard, { backgroundColor: palette.card }]}>
          <View style={emptyStyles.routeTop}>
            <View style={[emptyStyles.numberBox, { backgroundColor: palette.routeBadge }]}>
              <Text style={emptyStyles.numberText}>{r.number}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={emptyStyles.routeTitleRow}>
                <Text style={[emptyStyles.routeTitle, { color: palette.text }]}>{r.from} → {r.to}</Text>
                <View style={[emptyStyles.typeBadge, r.type === "Semi-Luxury" && emptyStyles.typeBadgeLux]}>
                  <Text style={[emptyStyles.typeText, r.type === "Semi-Luxury" && { color: "#f5a623" }]}>{r.type}</Text>
                </View>
              </View>
              <View style={emptyStyles.metaRow}>
                <Ionicons name="navigate-outline" size={11} color="#aaa" />
                <Text style={emptyStyles.metaText}>{r.km} km</Text>
                <Text style={emptyStyles.dot}>·</Text>
                <Ionicons name="time-outline" size={11} color="#aaa" />
                <Text style={emptyStyles.metaText}>{r.duration}</Text>
                <Text style={emptyStyles.dot}>·</Text>
                <Text style={[emptyStyles.metaText, { color: "#1a3cff", fontWeight: "700" }]}>LKR {r.fare}/seat</Text>
              </View>
              <Text style={emptyStyles.stops} numberOfLines={1}>{r.stops}</Text>
            </View>
          </View>
          <TouchableOpacity style={[emptyStyles.bookBtn, { backgroundColor: palette.routeBadge }]} onPress={() => router.push("/newbooking")}>
            <Text style={emptyStyles.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={emptyStyles.demoBtn} onPress={handleSeed} disabled={seeding}>
        {seeding
          ? <ActivityIndicator color="#1a3cff" size="small" />
          : <><Ionicons name="flash-outline" size={16} color="#1a3cff" /><Text style={emptyStyles.demoBtnText}>Load Sample Bookings</Text></>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const emptyStyles = StyleSheet.create({
  wrap:         { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, alignItems: "center" },
  title:        { fontSize: 18, fontWeight: "bold", marginTop: 12, marginBottom: 4 },
  sub:          { fontSize: 13, color: "#aaa", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  routeCard:    { width: "100%", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  routeTop:     { flexDirection: "row", gap: 12, marginBottom: 10 },
  numberBox:    { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  numberText:   { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  routeTitleRow:{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  routeTitle:   { fontSize: 14, fontWeight: "700" },
  typeBadge:    { backgroundColor: "#f0f4ff", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typeBadgeLux: { backgroundColor: "#fff8e1" },
  typeText:     { fontSize: 10, fontWeight: "700", color: "#1a3cff" },
  metaRow:      { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  metaText:     { fontSize: 11, color: "#aaa" },
  dot:          { fontSize: 11, color: "#ddd" },
  stops:        { fontSize: 11, color: "#bbb", fontStyle: "italic" },
  bookBtn:      { borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1, borderColor: "#d0d8ff" },
  bookBtnText:  { fontSize: 13, fontWeight: "700", color: "#1a3cff" },
  demoBtn:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: "#d0d8ff", borderStyle: "dashed" },
  demoBtnText:  { fontSize: 14, fontWeight: "600", color: "#1a3cff" },
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
