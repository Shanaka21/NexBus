import { useState, useCallback, useEffect } from "react";
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
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson } from "../lib/api";
import { useTheme } from "../lib/themeContext";
import { msAgo } from "../lib/format";

type Booking = {
  id: string;
  booking_reference: string | null;
  route: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  seat_numbers?: number[];
  trip_id?: string | null;
  status: string;
  fare: string;
  payment_status: string;
  hold_expires_at: number | null;
  refund_required: boolean;
  boarding_code?: string | null;
  boarded_at?: number | null;
};

const statusColors: any = {
  pending_payment: { bg: "#fff3e0", text: "#ff9800", icon: "time-outline" },
  confirmed: { bg: "#e8f5e9", text: "#4caf50", icon: "checkmark-circle-outline" },
  completed: { bg: "#e3f2fd", text: "#1a3cff", icon: "flag-outline" },
  cancelled: { bg: "#ffebee", text: "#f44336", icon: "close-circle-outline" },
  expired: { bg: "#eeeeee", text: "#9e9e9e", icon: "hourglass-outline" },
};

const statusLabel = (s: string) =>
  s === "pending_payment" ? "Awaiting payment" : s.charAt(0).toUpperCase() + s.slice(1);

// What the public bus list says about a bus: its current trip and the last position it sent
type LiveBus = { trip_id: string | null; lat: number | null; last_update_at: number | null; delay_minutes?: number };
const OFFLINE_MS = 2 * 60 * 1000;
const BUS_POLL_MS = 10000;

const TABS = [
  { key: "All", label: "All", match: (_b: Booking) => true },
  { key: "Pending", label: "Pending", match: (b: Booking) => b.status === "pending_payment" },
  { key: "Confirmed", label: "Confirmed", match: (b: Booking) => b.status === "confirmed" },
  { key: "Completed", label: "Completed", match: (b: Booking) => b.status === "completed" },
  { key: "Cancelled", label: "Cancelled", match: (b: Booking) => b.status === "cancelled" || b.status === "expired" },
];

const EMPTY_TEXT: Record<string, string> = {
  All: "Reserve a seat on a trip, pay securely online and track your bus live.",
  Pending: "You have no bookings waiting for payment.",
  Confirmed: "Bookings you have paid for will appear here.",
  Completed: "Trips you have finished will appear here.",
  Cancelled: "You have not cancelled any bookings.",
};

// Seats are held for a short time while the passenger pays; show how long is left
function holdLeft(expiresAt: number | null, now: number): string | null {
  if (!expiresAt) return null;
  const s = Math.max(0, Math.round((expiresAt - now) / 1000));
  if (s === 0) return "Hold expired";
  return `Pay within ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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
  seatChip:    "#f0f4ff",
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
  seatChip:    "#1e2250",
};

export default function BookingsScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [activeTab, setActiveTab] = useState("All");
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [now, setNow]             = useState(() => Date.now());
  const [liveBuses, setLiveBuses]   = useState<LiveBus[]>([]);
  const [codeOpen, setCodeOpen]     = useState<string | null>(null); // booking whose boarding code is showing

  const fetchBookings = useCallback(async () => {
    try {
      const { ok, data } = await apiJson("/bookings/me");
      if (ok && Array.isArray(data)) { setBookings(data); setError(null); }
      else setError(data?.error || "Could not load your bookings.");
    } catch {
      setError("Could not reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen comes back into view; only the first load shows a full-screen spinner
  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  // The payment countdown ticks every second, but only while a booking is waiting for payment
  const hasPending = bookings.some((b) => b.status === "pending_payment" && b.hold_expires_at);
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasPending]);

  // A confirmed booking shows whether its bus is live; the list refreshes itself, so a bus goes offline here
  // soon after the driver ends the trip
  const hasConfirmed = bookings.some((b) => b.status === "confirmed" && b.trip_id);
  useEffect(() => {
    if (!hasConfirmed) return;
    let stopped = false;
    const load = async () => {
      fetchBookings(); // keeps codes and verified ticks current without a manual refresh
      try {
        const { ok, data } = await apiJson("/buses");
        if (!stopped && ok && Array.isArray(data)) { setLiveBuses(data); setNow(Date.now()); }
      } catch { /* keep the last list */ }
    };
    load();
    const timer = setInterval(load, BUS_POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [hasConfirmed, fetchBookings]);

  // the bus of this booking's trip, if it is running and still sending positions
  const busFor = (b: Booking): LiveBus | null =>
    liveBuses.find((x) => x.trip_id && x.trip_id === b.trip_id && x.lat != null && x.last_update_at && now - x.last_update_at <= OFFLINE_MS) || null;

  const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
  const filtered = bookings.filter(tab.match);
  const count = (key: string) => bookings.filter((TABS.find((t) => t.key === key) || TABS[0]).match).length;

  const handleCancel = (id: string, paid: boolean) => {
    Alert.alert(
      "Cancel Booking",
      paid ? "Your payment will be refunded by the operator. Cancel this booking?" : "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel", style: "destructive",
          onPress: async () => {
            setCancelling(id);
            try {
              const { ok, data } = await apiJson(`/bookings/${id}/cancel`, { method: "PATCH" });
              if (!ok) { Alert.alert("Error", data?.error || "Could not cancel booking."); return; }
              setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "cancelled", refund_required: !!data.refund_required } : b));
              Alert.alert("Cancelled", data.refund_required ? "Your booking has been cancelled. The operator will process your refund." : "Your booking has been cancelled.");
            } catch {
              Alert.alert("Error", "Could not cancel booking.");
            } finally {
              setCancelling(null);
            }
          },
        },
      ]
    );
  };

  const renderBooking = ({ item }: { item: Booking }) => {
    const sc = statusColors[item.status] || statusColors.confirmed;
    const timer = item.status === "pending_payment" ? holdLeft(item.hold_expires_at, now) : null;
    const expired = timer === "Hold expired";
    const seatText = item.seat_numbers?.length ? item.seat_numbers.map((n) => `${n}`) : [];
    const bus = item.status === "confirmed" ? busFor(item) : null;
    const busOffline = item.status === "confirmed" && !bus;
    const canShowCode = item.status === "confirmed" && !!item.boarding_code;
    const showCode = canShowCode && codeOpen === item.id;
    return (
      <TouchableOpacity
        activeOpacity={canShowCode ? 0.85 : 1}
        disabled={!canShowCode}
        onPress={() => setCodeOpen(showCode ? null : item.id)}
        style={[styles.bookingCard, { backgroundColor: p.card }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.routeBadge, { backgroundColor: p.routeBadge }]}>
            <Ionicons name="bus" size={13} color="#1a3cff" />
            <Text style={styles.routeNumber}>{item.route}</Text>
          </View>
          {item.booking_reference ? <Text style={styles.reference}>#{item.booking_reference}</Text> : <View style={{ flex: 1 }} />}
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={13} color={sc.text} />
            <Text style={[styles.statusText, { color: sc.text }]}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        {/* From → To timeline */}
        <View style={styles.timeline}>
          <View style={styles.timelineRail}>
            <View style={styles.dotBlue} />
            <View style={[styles.railLine, { backgroundColor: p.routeLine }]} />
            <View style={styles.dotRing} />
          </View>
          <View style={styles.timelineText}>
            <Text style={[styles.routeText, { color: p.text }]} numberOfLines={1}>{item.from}</Text>
            <Text style={[styles.routeText, { color: p.text }]} numberOfLines={1}>{item.to}</Text>
          </View>
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>FARE</Text>
            <Text style={[styles.fareValue, { color: p.text }]}>{item.fare}</Text>
          </View>
        </View>

        {/* Ticket tear line */}
        <View style={styles.tear}>
          <View style={[styles.tearNotch, styles.tearLeft, { backgroundColor: p.bg }]} />
          <View style={[styles.tearDash, { borderColor: p.routeLine }]} />
          <View style={[styles.tearNotch, styles.tearRight, { backgroundColor: p.bg }]} />
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}><Ionicons name="calendar-outline" size={15} color="#888" /><Text style={styles.detailText}>{item.date}</Text></View>
          <View style={styles.detailItem}><Ionicons name="time-outline" size={15} color="#888" /><Text style={styles.detailText}>{item.time}</Text></View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={15} color="#888" />
            {seatText.length > 0 ? (
              <View style={styles.seatChips}>
                {seatText.map((n) => (
                  <View key={n} style={[styles.seatChip, { backgroundColor: p.seatChip }]}><Text style={styles.seatChipText}>{n}</Text></View>
                ))}
              </View>
            ) : (
              <Text style={styles.detailText}>{item.seats} {item.seats === 1 ? "seat" : "seats"}</Text>
            )}
          </View>
        </View>

        {timer && (
          <View style={[styles.holdBanner, expired && { backgroundColor: "#ffebee" }]}>
            <Ionicons name="timer-outline" size={15} color={expired ? "#f44336" : "#e68900"} />
            <Text style={[styles.holdText, expired && { color: "#f44336" }]}>
              {expired ? "Your seat hold has expired. Book again to reserve a seat." : `${timer} to keep your seat`}
            </Text>
          </View>
        )}

        {canShowCode && (
          showCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>YOUR BOARDING CODE</Text>
              <Text style={styles.codeValue}>{item.boarding_code}</Text>
              <Text style={styles.codeHint}>
                {item.boarded_at ? "The driver has verified you. Have a safe trip." : "Tell this code to the driver when you board."}
              </Text>
            </View>
          ) : (
            <View style={styles.codeTap}>
              <Ionicons name={item.boarded_at ? "checkmark-circle" : "key-outline"} size={15} color="#1a3cff" />
              <Text style={styles.codeTapText}>{item.boarded_at ? "Verified by the driver" : "Tap to show your boarding code"}</Text>
            </View>
          )
        )}

        {item.refund_required && (
          <View style={styles.holdBanner}>
            <Ionicons name="information-circle-outline" size={15} color="#e68900" />
            <Text style={styles.holdText}>Refund pending: the operator will process it manually.</Text>
          </View>
        )}

        {item.status === "pending_payment" && !expired && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.trackBtn} onPress={() => router.push({ pathname: "/payment", params: { id: item.id } } as any)}>
              <Ionicons name="card-outline" size={15} color="#fff" />
              <Text style={styles.trackBtnText}>Pay now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id, false)} disabled={cancelling === item.id}>
              {cancelling === item.id ? <ActivityIndicator size="small" color="#f44336" /> : <Text style={styles.cancelBtnText}>Cancel</Text>}
            </TouchableOpacity>
          </View>
        )}

        {item.status === "confirmed" && (
          <View style={[styles.busState, busOffline ? styles.busStateOff : styles.busStateOn]}>
            <View style={[styles.busDot, { backgroundColor: busOffline ? "#9e9e9e" : "#4caf50" }]} />
            <Text style={[styles.busStateText, { color: busOffline ? "#757575" : "#2e7d32" }]}>
              {busOffline
                ? "Bus offline · live tracking starts when the driver begins the trip"
                : `Bus is live${bus && bus.delay_minutes && bus.delay_minutes >= 10 ? ` · ${bus.delay_minutes} min late` : ""} · ${msAgo(bus?.last_update_at)}`}
            </Text>
          </View>
        )}

        {item.status === "confirmed" && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.trackBtn, busOffline && styles.trackBtnOff]}
              onPress={() => router.push("/map")}
              disabled={busOffline}
            >
              <Ionicons name={busOffline ? "moon-outline" : "location-outline"} size={15} color="#fff" />
              <Text style={styles.trackBtnText}>{busOffline ? "Bus offline" : "Track Bus"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id, item.payment_status === "success")} disabled={cancelling === item.id}>
              {cancelling === item.id ? <ActivityIndicator size="small" color="#f44336" /> : <Text style={styles.cancelBtnText}>Cancel</Text>}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {/* Stats Row */}
      <View style={[styles.statsRow, { backgroundColor: p.statsRow }]}>
        {[
          { label: "Total", value: bookings.length, color: p.text, tab: "All" },
          { label: "Confirmed", value: count("Confirmed"), color: "#4caf50", tab: "Confirmed" },
          { label: "Completed", value: count("Completed"), color: "#1a3cff", tab: "Completed" },
          { label: "Cancelled", value: count("Cancelled"), color: "#f44336", tab: "Cancelled" },
        ].map((s, i) => (
          <View key={s.label} style={styles.statWrap}>
            {i > 0 && <View style={[styles.statDivider, { backgroundColor: p.statDivider }]} />}
            <TouchableOpacity style={styles.statBox} onPress={() => setActiveTab(s.tab)} activeOpacity={0.7}>
              <Text style={[styles.statNumber, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Tabs (scroll sideways on narrow screens) */}
      <View style={styles.tabWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TABS.map((t) => {
            const active = activeTab === t.key;
            const n = count(t.key);
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, { backgroundColor: p.tab }, active && styles.tabActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
                {n > 0 && t.key !== "All" && (
                  <View style={[styles.tabCount, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <Text style={[styles.tabCountText, active && { color: "#fff" }]}>{n}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={16} color="#b02f2f" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchBookings(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a3cff" colors={["#1a3cff"]} />}
          ListEmptyComponent={error ? null : <EmptyState router={router} palette={p} tab={activeTab} />}
          renderItem={renderBooking}
        />
      )}

      <TouchableOpacity style={styles.bookRideBtn} onPress={() => router.push("/newbooking" as any)} activeOpacity={0.9}>
        <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.bookRideGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
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
          <View style={[styles.navPill, { backgroundColor: p.routeBadge }]}>
            <Ionicons name="ticket" size={22} color="#1a3cff" />
          </View>
          <Text style={[styles.navText, { color: "#1a3cff", fontWeight: "700" }]}>Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({ router, palette, tab }: { router: any; palette: typeof light; tab: string }) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={[emptyStyles.iconCircle, { backgroundColor: palette.routeBadge }]}>
        <Ionicons name="ticket-outline" size={34} color="#1a3cff" />
      </View>
      <Text style={[emptyStyles.title, { color: palette.text }]}>{tab === "All" ? "No Bookings Yet" : `No ${tab.toLowerCase()} bookings`}</Text>
      <Text style={emptyStyles.sub}>{EMPTY_TEXT[tab]}</Text>
      {tab === "All" && (
        <TouchableOpacity style={[emptyStyles.bookBtn, { backgroundColor: palette.routeBadge }]} onPress={() => router.push("/newbooking")}>
          <Text style={emptyStyles.bookBtnText}>Book a seat</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap:         { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40, alignItems: "center" },
  iconCircle:   { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 18, fontWeight: "bold", marginTop: 14, marginBottom: 4 },
  sub:          { fontSize: 13, color: "#aaa", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  bookBtn:      { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28, alignItems: "center", borderWidth: 1, borderColor: "#d0d8ff" },
  bookBtnText:  { fontSize: 14, fontWeight: "700", color: "#1a3cff" },
});

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },

  statsRow:    { flexDirection: "row", paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12 },
  statWrap:    { flex: 1, flexDirection: "row", alignItems: "stretch" },
  statBox:     { flex: 1, alignItems: "center", paddingVertical: 2 },
  statNumber:  { fontSize: 22, fontWeight: "bold" },
  statLabel:   { fontSize: 11, color: "#888", marginTop: 2 },
  statDivider: { width: 1 },

  tabWrap:      { marginBottom: 12 },
  tabRow:       { flexDirection: "row", paddingHorizontal: 16, gap: 8 },
  tab:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabActive:    { backgroundColor: "#1a3cff" },
  tabText:      { fontSize: 13, color: "#888" },
  tabTextActive:{ color: "#fff", fontWeight: "600" },
  tabCount:     { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: "#e8ecff", alignItems: "center", justifyContent: "center" },
  tabCountText: { fontSize: 11, fontWeight: "700", color: "#1a3cff" },

  errorBox:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fbe4e4", marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12 },
  errorText: { flex: 1, fontSize: 13, color: "#8f2222" },
  retryText: { fontSize: 13, fontWeight: "700", color: "#1a3cff" },

  list: { paddingHorizontal: 16, paddingBottom: 160 },

  bookingCard: { borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  cardHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  routeBadge:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  routeNumber: { fontSize: 15, fontWeight: "bold", color: "#1a3cff" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 12, fontWeight: "600" },
  reference:   { fontSize: 12, color: "#888", letterSpacing: 0.5, flex: 1 },

  timeline:     { flexDirection: "row", alignItems: "stretch", gap: 12, marginBottom: 14 },
  timelineRail: { alignItems: "center", paddingVertical: 4, width: 12 },
  railLine:     { flex: 1, width: 2, marginVertical: 3, minHeight: 16 },
  dotBlue:      { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1a3cff" },
  dotRing:      { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#1a3cff" },
  timelineText: { flex: 1, justifyContent: "space-between", gap: 14 },
  routeText:    { fontSize: 15, fontWeight: "600" },
  fareBox:      { alignItems: "flex-end", justifyContent: "center" },
  fareLabel:    { fontSize: 10, letterSpacing: 1, color: "#aaa", fontWeight: "700" },
  fareValue:    { fontSize: 15, fontWeight: "bold", marginTop: 2 },

  tear:       { flexDirection: "row", alignItems: "center", marginHorizontal: -16, marginBottom: 12 },
  tearDash:   { flex: 1, borderTopWidth: 1.5, borderStyle: "dashed", marginHorizontal: 6 },
  tearNotch:  { width: 14, height: 14, borderRadius: 7 },
  tearLeft:   { marginLeft: -7 },
  tearRight:  { marginRight: -7 },

  detailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 12 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  detailText: { fontSize: 13, color: "#888" },
  seatChips:  { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  seatChip:   { minWidth: 24, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignItems: "center" },
  seatChipText:{ fontSize: 12, fontWeight: "700", color: "#1a3cff" },

  holdBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff3e0", padding: 10, borderRadius: 10, marginBottom: 12 },
  codeBox:    { alignItems: "center", backgroundColor: "#f0f4ff", borderRadius: 12, paddingVertical: 14, marginBottom: 12 },
  codeLabel:  { fontSize: 11, fontWeight: "700", color: "#6a74a8", letterSpacing: 1 },
  codeValue:  { fontSize: 38, fontWeight: "800", color: "#1a3cff", letterSpacing: 10, marginVertical: 4, paddingLeft: 10 },
  codeHint:   { fontSize: 12, color: "#6a74a8" },
  codeTap:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  codeTapText:{ fontSize: 12.5, color: "#1a3cff", fontWeight: "600" },
  holdText:   { flex: 1, fontSize: 12.5, color: "#a96400", fontWeight: "500" },

  busState:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  busStateOn:   { backgroundColor: "#e8f5e9" },
  busStateOff:  { backgroundColor: "#eeeeee" },
  busDot:       { width: 8, height: 8, borderRadius: 4 },
  busStateText: { flex: 1, fontSize: 12.5, fontWeight: "600" },

  actionsRow:    { flexDirection: "row", gap: 10 },
  trackBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#1a3cff", borderRadius: 12, paddingVertical: 12, gap: 6 },
  trackBtnOff:   { backgroundColor: "#9aa0b4" },
  trackBtnText:  { color: "#fff", fontSize: 14, fontWeight: "600" },
  cancelBtn:     { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffebee", borderRadius: 12, paddingVertical: 12 },
  cancelBtnText: { color: "#f44336", fontSize: 14, fontWeight: "600" },

  bookRideBtn:     { position: "absolute", bottom: 84, left: 16, right: 16, borderRadius: 14, shadowColor: "#1a3cff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  bookRideGradient:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 10 },
  bookRideText:    { color: "#fff", fontSize: 16, fontWeight: "bold" },

  bottomNav:  { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10, paddingBottom: 24 },
  navItem:    { flex: 1, alignItems: "center", gap: 3 },
  navPill:    { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 14 },
  navText:    { fontSize: 11 },
});
