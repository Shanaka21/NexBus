import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  FlatList,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { apiJson } from "../lib/api";
import { stopLabel, LIVE_STATUS, secondsAgo } from "../lib/format";
import { useTheme } from "../lib/themeContext";

type ApiStop = { id: string; name: string; name_si?: string; latitude: number; longitude: number };

type Arrival = {
  trip_id: string; route_number: string; destination: string; registration_no: string;
  eta_min: number; status: string; delay_minutes: number; updated_seconds_ago: number | null;
  reservable_seats: number; available_seats: number;
};

type QuickRoute = { id: string; number: string; from: string; to: string };

type Bus = {
  id: string;
  route_number: string;
  start_point: string;
  end_point: string;
  route_name: string;
  status: string;
};

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

const light = {
  bg:               "#f0f0f5",
  card:             "#fff",
  text:             "#1a1a4e",
  subText:          "#888",
  searchBg:         "#fff",
  searchText:       "#333",
  iconBox:          "#f0f4ff",
  mapPlaceholder:   "#e8eeff",
  smartBanner:      "#eef2ff",
  smartBannerBorder:"#c8d6ff",
  noTripBanner:     "#f0f4ff",
  noTripBorder:     "#d0d8ff",
  bottomNav:        "#fff",
  bottomNavBorder:  "#eee",
  directionsBtn:    "#f0f4ff",
  divider:          "#eee",
};

const dark = {
  bg:               "#0d0d1a",
  card:             "#1a1a2e",
  text:             "#dde0ff",
  subText:          "#888",
  searchBg:         "#1a1a2e",
  searchText:       "#dde0ff",
  iconBox:          "#1e2250",
  mapPlaceholder:   "#1e2250",
  smartBanner:      "#1e2250",
  smartBannerBorder:"#2a3480",
  noTripBanner:     "#1e2250",
  noTripBorder:     "#2a3480",
  bottomNav:        "#1a1a2e",
  bottomNavBorder:  "#2a2a4e",
  directionsBtn:    "#1e2250",
  divider:          "#2a2a4e",
};

export default function HomeScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [searchText, setSearchText] = useState("");
  const [buses, setBuses]   = useState<Bus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  type NearestStop = { stop: ApiStop; distanceM: number };
  const [nearestStop, setNearestStop] = useState<NearestStop | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [stopLoading, setStopLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [quickRoutes, setQuickRoutes] = useState<QuickRoute[]>([]);

  const loadArrivals = async (stopId: string) => {
    try {
      const { ok, data } = await apiJson(`/stops/${stopId}/arrivals`);
      if (ok && Array.isArray(data)) setArrivals(data.slice(0, 4));
    } catch { /* keep the last arrivals */ }
  };

  const findNearestStop = async () => {
    setStopLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      // The position is only used for this query and is never stored by the server
      const { ok, data } = await apiJson(`/stops?near=${latitude},${longitude}&limit=1`);
      if (ok && data[0]) {
        setNearestStop({ stop: data[0], distanceM: Math.round(data[0].distance_km * 1000) });
        loadArrivals(data[0].id);
      }
    } catch { /* silently fail */ }
    setStopLoading(false);
  };

  const openDirections = () => {
    if (!nearestStop) return;
    const { latitude, longitude } = nearestStop.stop;
    const url = Platform.OS === "ios"
      ? `maps://?daddr=${latitude},${longitude}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
    Linking.openURL(url);
  };

  useEffect(() => {
    findNearestStop(); // the nearest stop and its next buses are shown as soon as the home screen opens

    apiJson("/buses").then(({ ok, data }) => { if (ok && Array.isArray(data)) setBuses(data); }).catch(() => {});
    apiJson("/bookings/me").then(({ ok, data }) => { if (ok && Array.isArray(data)) setBookings(data); }).catch(() => {});
    apiJson("/notifications/me").then(({ ok, data }) => {
      if (ok && Array.isArray(data)) setUnread(data.filter((n: any) => !n.is_read).length);
    }).catch(() => {});
    apiJson("/routes").then(({ ok, data }) => {
      if (ok && Array.isArray(data)) {
        setQuickRoutes(data.slice(0, 12).map((r: any) => ({ id: r.id, number: r.route_number, from: r.start_point, to: r.end_point })));
      }
    }).catch(() => {});
  }, []);

  // Arrival times change as buses move
  useEffect(() => {
    if (!nearestStop) return;
    const timer = setInterval(() => loadArrivals(nearestStop.stop.id), 30000);
    return () => clearInterval(timer);
  }, [nearestStop]);

  const activeBooking = bookings.find((b) => b.status === "confirmed") ?? null;
  const recentRoutes  = bookings.slice(0, 3);
  const notifCount    = unread;

  const results =
    searchText.trim().length === 0
      ? []
      : buses.filter((b) => {
          const q = searchText.toLowerCase();
          return (
            b.route_number?.toLowerCase().includes(q) ||
            b.end_point?.toLowerCase().includes(q) ||
            b.start_point?.toLowerCase().includes(q) ||
            b.route_name?.toLowerCase().includes(q)
          );
        });
  const isSearching = searchText.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={p.bg} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: p.bg }]}>
        <TouchableOpacity onPress={() => router.push("/sidebar")}>
          <Ionicons name="menu" size={26} color={p.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: p.text }]}>NexBus</Text>
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push("/notifications")}
        >
          <Ionicons name="notifications-outline" size={26} color={p.text} />
          {notifCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: p.searchBg }]}>
          <Ionicons name="search-outline" size={18} color="#aaa" />
          <TextInput
            style={[styles.searchInput, { color: p.searchText }]}
            placeholder="Search route or destination..."
            placeholderTextColor="#aaa"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        /* ── Search Results ── */
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={40} color="#ccc" />
              <Text style={[styles.emptyText, { color: p.text }]}>No routes found for "{searchText}"</Text>
              <Text style={styles.emptySubText}>
                Try a route number like "138" or a place like "Maharagama"
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColor =
              item.status === "delayed"   ? "#ff9800"
              : item.status === "emergency" ? "#f44336"
              : "#4caf50";
            const statusBg =
              item.status === "delayed"   ? "#fff3e0"
              : item.status === "emergency" ? "#ffebee"
              : "#e8f5e9";
            const statusLabel =
              item.status === "delayed"   ? "DELAYED"
              : item.status === "emergency" ? "EMERGENCY"
              : "ON TIME";
            return (
              <View style={[styles.resultCard, { backgroundColor: p.card }]}>
                <View style={styles.resultTop}>
                  <View style={[styles.routeBadge, { backgroundColor: p.iconBox }]}>
                    <Text style={styles.routeBadgeText}>{item.route_number}</Text>
                  </View>
                  <View style={styles.resultRouteInfo}>
                    <Text style={[styles.resultRouteName, { color: p.text }]}>
                      {item.start_point} → {item.end_point}
                    </Text>
                    <Text style={styles.resultRouteSub}>
                      {item.route_name || `Route ${item.route_number}`}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusChipText, { color: statusColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.trackBtn}
                    onPress={() => { setSearchText(""); router.push("/map"); }}
                  >
                    <Ionicons name="location" size={14} color="#fff" />
                    <Text style={styles.trackBtnText}>Track Live</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bookBtn, { backgroundColor: p.iconBox }]}
                    onPress={() => { setSearchText(""); router.push("/newbooking" as any); }}
                  >
                    <Ionicons name="ticket-outline" size={14} color="#1a3cff" />
                    <Text style={styles.bookBtnText}>Book Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      ) : (
        /* ── Normal Home Content ── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Active Booking Banner ── */}
          {activeBooking ? (
            <LinearGradient
              colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
              style={styles.activeBanner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.activeBannerLeft}>
                <Text style={styles.activeBannerLabel}>YOUR NEXT TRIP</Text>
                <Text style={styles.activeBannerRoute}>
                  {activeBooking.from} → {activeBooking.to}
                </Text>
                <View style={styles.activeBannerMeta}>
                  <Ionicons name="bus-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.activeBannerMetaText}>Route {activeBooking.route}</Text>
                  <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.activeBannerMetaText}>{activeBooking.time}</Text>
                  <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.activeBannerMetaText}>{activeBooking.seats} seat(s)</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.activeBannerBtn} onPress={() => router.push("/map")}>
                <Ionicons name="navigate" size={16} color="#1a3cff" />
                <Text style={styles.activeBannerBtnText}>Track</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <TouchableOpacity
              style={[styles.noTripBanner, { backgroundColor: p.noTripBanner, borderColor: p.noTripBorder }]}
              onPress={() => router.push("/newbooking" as any)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#1a3cff" />
              <Text style={styles.noTripText}>No upcoming trips — Book a ride now</Text>
              <Ionicons name="chevron-forward" size={18} color="#1a3cff" />
            </TouchableOpacity>
          )}

          {/* ── View Live Map ── */}
          <TouchableOpacity onPress={() => router.push("/map")}>
            <LinearGradient
              colors={["#1a3cff", "#0d1b6e"]}
              style={styles.mapButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.mapButtonText}>View Live Map</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Smart Suggestions Banner ── */}
          <TouchableOpacity
            style={[styles.smartBanner, { backgroundColor: p.smartBanner, borderColor: p.smartBannerBorder }]}
            onPress={() => router.push("/smartsuggestions" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.smartBannerLeft}>
              <View style={[styles.smartBannerIcon, { backgroundColor: p.card }]}>
                <Ionicons name="bulb" size={20} color="#1a3cff" />
              </View>
              <View>
                <Text style={[styles.smartBannerTitle, { color: p.text }]}>Smart Suggestions</Text>
                <Text style={styles.smartBannerSub}>Find your best route instantly</Text>
              </View>
            </View>
            <View style={styles.smartBannerArrow}>
              <Text style={styles.smartBannerArrowText}>Try Now</Text>
              <Ionicons name="arrow-forward" size={14} color="#1a3cff" />
            </View>
          </TouchableOpacity>

          {/* ── Quick Book ── */}
          <Text style={[styles.sectionTitle, { color: p.text }]}>Quick Book</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickBookScroll}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          >
            {quickRoutes.map((route) => (
              <TouchableOpacity
                key={route.id}
                style={[styles.quickChip, { backgroundColor: p.card }]}
                onPress={() => router.push({ pathname: "/newbooking", params: { route_id: route.id } } as any)}
              >
                <View style={[styles.quickChipIcon, { backgroundColor: p.iconBox }]}>
                  <Ionicons name="bus" size={18} color="#1a3cff" />
                </View>
                <Text style={styles.quickChipNumber}>{route.number}</Text>
                <Text style={styles.quickChipRoute} numberOfLines={1}>{route.from}</Text>
                <Text style={styles.quickChipArrow}>↓</Text>
                <Text style={styles.quickChipRoute} numberOfLines={1}>{route.to}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Nearest Bus Stop Card ── */}
          <View style={[styles.card, { backgroundColor: p.card }]}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: p.text }]}>Nearest Bus Stop</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {nearestStop
                    ? `${stopLabel(nearestStop.stop)} (${nearestStop.distanceM < 1000
                        ? `${nearestStop.distanceM}m`
                        : `${(nearestStop.distanceM / 1000).toFixed(1)}km`})`
                    : "Tap to find your nearest stop"}
                </Text>
              </View>
              <View style={[styles.busIconBox, { backgroundColor: p.iconBox }]}>
                <Ionicons name="bus" size={22} color="#1a3cff" />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.mapPlaceholder, { backgroundColor: p.mapPlaceholder }]}
              onPress={nearestStop ? openDirections : findNearestStop}
              activeOpacity={0.8}
            >
              {nearestStop ? (
                <>
                  <Ionicons name="location" size={44} color="#1a3cff" opacity={0.6} />
                  <Text style={styles.stopFoundText}>{stopLabel(nearestStop.stop)}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="map" size={40} color="#1a3cff" opacity={0.3} />
                  <View style={styles.mapPin}>
                    <Ionicons name="location" size={28} color="#1a3cff" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {nearestStop ? (
              <TouchableOpacity
                style={[styles.directionsButton, { backgroundColor: p.directionsBtn }]}
                onPress={openDirections}
              >
                <Ionicons name="navigate" size={16} color="#1a3cff" />
                <Text style={styles.directionsText}>Open in Maps</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.directionsButton, { backgroundColor: p.directionsBtn }]}
                onPress={findNearestStop}
                disabled={stopLoading}
              >
                <Ionicons name={stopLoading ? "hourglass-outline" : "location-outline"} size={16} color="#1a3cff" />
                <Text style={styles.directionsText}>
                  {stopLoading ? "Finding stop…" : "Find Nearest Stop"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Next buses at the nearest stop ── */}
          {nearestStop && (
            <View style={[styles.card, { backgroundColor: p.card }]}>
              <Text style={[styles.cardTitle, { color: p.text }]}>Next buses</Text>
              <Text style={[styles.cardSubtitle, { marginBottom: 10 }]} numberOfLines={1}>at {nearestStop.stop.name}</Text>
              {arrivals.length === 0 && (
                <Text style={styles.arrivalSub}>No buses are expected here soon.</Text>
              )}
              {arrivals.map((a) => {
                const st = LIVE_STATUS[a.status] || LIVE_STATUS.scheduled;
                return (
                  <TouchableOpacity key={a.trip_id} style={styles.arrivalRow} onPress={() => router.push("/map")}>
                    <View style={[styles.arrivalBadge, { backgroundColor: p.iconBox }]}>
                      <Text style={styles.arrivalBadgeText}>{a.route_number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.arrivalTitle, { color: p.text }]} numberOfLines={1}>to {a.destination}</Text>
                      <Text style={styles.arrivalSub}>
                        {st.label.toLowerCase()}{a.delay_minutes >= 10 ? ` · ${a.delay_minutes} min late` : ""}
                        {a.reservable_seats > 0 ? ` · ${a.available_seats} seats` : ""}
                        {a.updated_seconds_ago != null ? ` · ${secondsAgo(a.updated_seconds_ago)}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.arrivalEta, { backgroundColor: st.bg }]}>
                      <Text style={[styles.arrivalEtaText, { color: st.color }]}>{a.eta_min} min</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Recent Routes ── */}
          <Text style={[styles.sectionTitle, { color: p.text }]}>Recent Routes</Text>

          {recentRoutes.length > 0 ? (
            recentRoutes.map((b) => {
              const statusColor =
                b.status === "confirmed" ? "#4caf50"
                : b.status === "cancelled" ? "#f44336"
                : "#1a3cff";
              const statusBg =
                b.status === "confirmed" ? "#e8f5e9"
                : b.status === "cancelled" ? "#ffebee"
                : "#e3f2fd";
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.recentCard, { backgroundColor: p.card }]}
                  onPress={() => router.push("/bookings")}
                >
                  <View style={styles.recentLeft}>
                    <View style={[styles.recentIcon, { backgroundColor: p.iconBox }]}>
                      <Ionicons name="time" size={20} color="#1a3cff" />
                    </View>
                    <View>
                      <Text style={[styles.recentRoute, { color: p.text }]}>
                        {b.from} → {b.to}
                      </Text>
                      <Text style={styles.recentSub}>Route {b.route} • {b.date}</Text>
                    </View>
                  </View>
                  <View style={[styles.recentStatus, { backgroundColor: statusBg }]}>
                    <Text style={[styles.recentStatusText, { color: statusColor }]}>
                      {b.status === "pending_payment" ? "Awaiting payment" : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.recentCard, { backgroundColor: p.card }]}>
              <View style={styles.recentLeft}>
                <View style={[styles.recentIcon, { backgroundColor: p.iconBox }]}>
                  <Ionicons name="time" size={20} color="#1a3cff" />
                </View>
                <View>
                  <Text style={[styles.recentRoute, { color: p.text }]}>No trips yet</Text>
                  <Text style={styles.recentSub}>Your bookings will appear here</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#aaa" />
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { backgroundColor: p.bottomNav, borderTopColor: p.bottomNavBorder }]}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/map")}>
          <Ionicons name="map-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/bookings")}>
          <Ionicons name="ticket-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  bellWrapper: { position: "relative" },
  badge: {
    position: "absolute",
    top: -4, right: -4,
    backgroundColor: "#f44336",
    borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, color: "#fff", fontWeight: "bold" },

  searchWrapper: { paddingHorizontal: 20, paddingBottom: 10 },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },

  resultsList: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },
  resultCard: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  routeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minWidth: 48, alignItems: "center" },
  routeBadgeText: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  resultRouteInfo: { flex: 1 },
  resultRouteName: { fontSize: 15, fontWeight: "700" },
  resultRouteSub: { fontSize: 12, color: "#888", marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusChipText: { fontSize: 11, fontWeight: "bold" },
  resultActions: { flexDirection: "row", gap: 10 },
  trackBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1a3cff", borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  trackBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  bookBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 10, paddingVertical: 10, gap: 6,
    borderWidth: 1, borderColor: "#d0d8ff",
  },
  bookBtnText: { color: "#1a3cff", fontWeight: "600", fontSize: 13 },
  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptySubText: { fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 20 },

  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  activeBanner: {
    borderRadius: 16, padding: 16, marginBottom: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  activeBannerLeft: { flex: 1 },
  activeBannerLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  activeBannerRoute: { fontSize: 18, fontWeight: "bold", color: "#fff", marginBottom: 6 },
  activeBannerMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  activeBannerMetaText: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  activeBannerBtn: {
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: "center", gap: 4, marginLeft: 12,
  },
  activeBannerBtnText: { fontSize: 12, fontWeight: "bold", color: "#1a3cff" },

  noTripBanner: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, padding: 14, marginBottom: 16, gap: 10,
    borderWidth: 1, borderStyle: "dashed",
  },
  noTripText: { flex: 1, fontSize: 14, color: "#1a3cff", fontWeight: "600" },

  mapButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 16, marginBottom: 20, gap: 10,
  },
  mapButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  sectionTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 12 },

  smartBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1.5,
  },
  smartBannerLeft:      { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  smartBannerIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  smartBannerTitle:     { fontSize: 14, fontWeight: "700" },
  smartBannerSub:       { fontSize: 12, color: "#6677cc", marginTop: 1 },
  smartBannerArrow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  smartBannerArrowText: { fontSize: 13, fontWeight: "700", color: "#1a3cff" },

  quickBookScroll: { marginBottom: 20 },
  quickChip: {
    borderRadius: 16, padding: 14, alignItems: "center", width: 100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, gap: 4,
  },
  quickChipIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  quickChipNumber: { fontSize: 15, fontWeight: "bold", color: "#1a3cff" },
  quickChipArrow:  { fontSize: 12, color: "#ccc" },
  quickChipRoute:  { fontSize: 11, color: "#888", textAlign: "center" },

  card: {
    borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle:    { fontSize: 16, fontWeight: "bold" },
  cardSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  busIconBox:   { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mapPlaceholder: {
    height: 130, borderRadius: 12,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  mapPin: { position: "absolute" },
  stopFoundText: { fontSize: 13, fontWeight: "600", color: "#1a3cff", marginTop: 8, textAlign: "center" },
  directionsButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 10, paddingVertical: 12, gap: 8,
  },
  directionsText: { fontSize: 14, color: "#1a3cff", fontWeight: "600" },

  arrivalRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  arrivalBadge:     { minWidth: 48, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  arrivalBadgeText: { fontSize: 15, fontWeight: "bold", color: "#1a3cff" },
  arrivalTitle:     { fontSize: 14, fontWeight: "600" },
  arrivalSub:       { fontSize: 12, color: "#888", marginTop: 2 },
  arrivalEta:       { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  arrivalEtaText:   { fontSize: 13, fontWeight: "bold" },

  recentCard: {
    borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  recentLeft:       { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  recentIcon:       { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  recentRoute:      { fontSize: 14, fontWeight: "600" },
  recentSub:        { fontSize: 12, color: "#888", marginTop: 2 },
  recentStatus:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  recentStatusText: { fontSize: 11, fontWeight: "600" },

  bottomNav: {
    flexDirection: "row", position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, paddingVertical: 10, paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText:  { fontSize: 11 },
});
