import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Platform, ActivityIndicator, AppState, Modal, Pressable,
} from "react-native";
import MapView, { Marker, BaseTiles, baseMapType, mapProvider } from "../lib/maps";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { apiJson } from "../lib/api";
import { useTheme } from "../lib/themeContext";
import { LIVE_STATUS, msAgo, stopLabel } from "../lib/format";

type Bus = {
  id: string;
  registration_no: string;
  route_number: string;
  lat: number;
  lng: number;
  delay_minutes: number;
  last_update_at: number | null;
  current_trip_id: string | null;
};

type TripLive = {
  trip_id: string; route_name: string; status: string; delay_minutes: number;
  reservable_seats: number; available_seats: number; fare_lkr: number;
  next_stops: { stop_id: string; name: string; name_si: string; eta_min: number | null }[];
};

const OFFLINE_MS = 2 * 60 * 1000;
const PALETTE = ["#e53935", "#8e24aa", "#1e88e5", "#43a047", "#fb8c00", "#1a3cff", "#d81b60", "#00897b", "#6d4c41", "#f4511e", "#039be5"];
const routeColor = (route: string) => PALETTE[[...route].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];

// A bus with no update for 2 minutes is shown as offline (grey)
const liveStatus = (b: Bus, now: number) =>
  !b.last_update_at || now - b.last_update_at > OFFLINE_MS ? "offline" : b.delay_minutes >= 10 ? "delayed" : "on_time";

type StatusFilter = "all" | "on_time" | "delayed" | "offline";
const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "on_time", label: "On time" },
  { key: "delayed", label: "Delayed" },
  { key: "offline", label: "Offline" },
];

const light = {
  bg: "#fff", header: "#fff", text: "#1a1a4e", filterRow: "#fff", chip: "#fff", chipBorder: "#e0e0e0",
  chipText: "#555", liveIndicator: "#fff", liveText: "#1a1a4e", busCard: "#fff", routeTag: "#f0f4ff",
  bottomNav: "#fff", bottomNavBorder: "#eee", subText: "#888",
};
const dark = {
  bg: "#0d0d1a", header: "#0d0d1a", text: "#dde0ff", filterRow: "#0d0d1a", chip: "#1a1a2e", chipBorder: "#2a2a4e",
  chipText: "#aaa", liveIndicator: "#1a1a2e", liveText: "#dde0ff", busCard: "#1a1a2e", routeTag: "#1e2250",
  bottomNav: "#1a1a2e", bottomNavBorder: "#2a2a4e", subText: "#888",
};

export default function MapScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [buses, setBuses] = useState<Bus[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterRoute, setFilterRoute] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<TripLive | null>(null);

  // Live positions are polled from the API every 2 seconds (paused while the app is in the background).
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (AppState.currentState !== "active") return;
      try {
        const { ok, data } = await apiJson("/buses");
        if (stopped) return;
        if (ok && Array.isArray(data)) {
          setBuses(data.filter((b: any) => b.trip_id && b.lat != null).map((b: any) => ({
            id: b.id, registration_no: b.bus_number, route_number: b.route_number, lat: b.lat, lng: b.lng,
            delay_minutes: b.delay_minutes || 0, last_update_at: b.last_update_at, current_trip_id: b.trip_id,
          })));
          setConnected(true);
        } else setConnected(false);
      } catch { if (!stopped) setConnected(false); }
      if (!stopped) setLoading(false);
    };
    load();
    const poll = setInterval(load, 2000);
    return () => { stopped = true; clearInterval(poll); };
  }, []);

  // Re-evaluate offline status and "updated N s ago" every few seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const selected = buses.find((b) => b.id === selectedId) || null;

  // The API drops a bus from the list when its driver ends the trip; close its panel and say why
  const [endedNotice, setEndedNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId || loading || buses.some((b) => b.id === selectedId)) return;
    setSelectedId(null);
    setEndedNotice(`Bus ${selectedId} has finished its trip and is now offline.`);
  }, [buses, selectedId, loading]);
  useEffect(() => {
    if (!endedNotice) return;
    const t = setTimeout(() => setEndedNotice(null), 6000);
    return () => clearTimeout(t);
  }, [endedNotice]);

  const loadDetail = useCallback(async (bus: Bus) => {
    setDetail(null);
    if (!bus.current_trip_id) return;
    const { ok, data } = await apiJson(`/trips/${bus.current_trip_id}/live`);
    if (ok) setDetail(data);
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    loadDetail(selected);
    const timer = setInterval(() => loadDetail(selected), 15000);
    return () => clearInterval(timer);
  }, [selected?.id, loadDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const routes = useMemo(() => [...new Set(buses.map((b) => b.route_number))].sort(), [buses]);
  const matchesRoute = (b: Bus) => !filterRoute || b.route_number === filterRoute;
  const matchesStatus = (b: Bus, key: StatusFilter) => key === "all" || liveStatus(b, now) === key;
  const visible = buses.filter((b) => matchesRoute(b) && matchesStatus(b, filterStatus));
  const activeFilters = (filterRoute ? 1 : 0) + (filterStatus !== "all" ? 1 : 0);
  const resetFilters = () => { setFilterRoute(null); setFilterStatus("all"); };

  const statusPill = (bus: Bus) => {
    const s = LIVE_STATUS[liveStatus(bus, now)];
    return (
      <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: s.color }]} />
        <Text style={[styles.statusText, { color: s.color }]}>
          {s.label}{bus.delay_minutes >= 10 ? ` · ${bus.delay_minutes} min late` : ""}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.header, { backgroundColor: p.header }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={p.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: p.text }]}>Live Map</Text>
        <TouchableOpacity onPress={() => setShowFilters(true)} hitSlop={10} accessibilityLabel="Filter buses">
          <Ionicons name="options-outline" size={24} color={activeFilters ? "#1a3cff" : p.text} />
          {activeFilters > 0 && (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilters}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {!connected && (
        <View style={styles.banner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={styles.bannerText}>Connection lost. Showing the last known positions.</Text>
        </View>
      )}

      {endedNotice && (
        <View style={[styles.banner, { backgroundColor: "#546e7a" }]}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
          <Text style={styles.bannerText}>{endedNotice}</Text>
        </View>
      )}

      <View style={[styles.filterRow, { backgroundColor: p.filterRow }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {routes.map((r) => {
            const active = filterRoute === r;
            const color = routeColor(r);
            return (
              <TouchableOpacity
                key={r}
                style={[styles.filterChip, { backgroundColor: p.chip, borderColor: p.chipBorder }, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setFilterRoute(active ? null : r)}
              >
                <Text style={[styles.filterChipText, { color: p.chipText }, active && { color: "#fff" }]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <>
          <MapView
            style={Platform.OS === "web" ? styles.mapWeb : styles.map}
            provider={mapProvider}
            // "mutedStandard" exists only in Apple Maps; on Android it renders a blank map
            mapType={Platform.OS === "ios" && !mapProvider ? "mutedStandard" : baseMapType}
            initialRegion={{ latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.22, longitudeDelta: 0.22 }}
            showsUserLocation
            showsMyLocationButton
            showsCompass
            showsScale
          >
            <BaseTiles />
            {visible.map((bus) => {
              const status = liveStatus(bus, now);
              const color = status === "offline" ? "#9e9e9e" : status === "delayed" ? "#ff9800" : routeColor(bus.route_number);
              return (
                <Marker
                  key={bus.id}
                  coordinate={{ latitude: bus.lat, longitude: bus.lng }}
                  onPress={() => setSelectedId(bus.id)}
                  title={`Route ${bus.route_number}`}
                  description={`${bus.registration_no} · ${msAgo(bus.last_update_at)}`}
                >
                  <View style={[styles.busMarker, { backgroundColor: color }]}>
                    <Ionicons name="bus" size={14} color="#fff" />
                  </View>
                </Marker>
              );
            })}
          </MapView>

          {/* On the web there is no native map, so the live buses are listed */}
          {Platform.OS === "web" && (
            <ScrollView style={styles.webList} contentContainerStyle={{ padding: 12, gap: 8 }}>
              {visible.length === 0 && <Text style={{ color: p.subText, textAlign: "center" }}>No buses are running right now.</Text>}
              {visible.map((bus) => (
                <TouchableOpacity key={bus.id} style={[styles.webRow, { backgroundColor: p.busCard }]} onPress={() => setSelectedId(bus.id)}>
                  <View style={[styles.routeTag, { backgroundColor: p.routeTag }]}>
                    <Text style={styles.routeTagText}>{bus.route_number}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.busRoute, { color: p.text }]}>{bus.registration_no}</Text>
                    <Text style={styles.busNumber}>{msAgo(bus.last_update_at)}</Text>
                  </View>
                  {statusPill(bus)}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}

      <View style={[styles.liveIndicator, { backgroundColor: p.liveIndicator }]}>
        <View style={[styles.liveDot, !connected && { backgroundColor: "#9e9e9e" }]} />
        <Text style={[styles.liveText, { color: p.liveText }]}>
          {visible.length} bus{visible.length !== 1 ? "es" : ""} live
        </Text>
      </View>

      {selected && (
        <View style={[styles.busCard, { backgroundColor: p.busCard }]}>
          <View style={[styles.busCardAccent, { backgroundColor: routeColor(selected.route_number) }]} />
          <View style={styles.busCardBody}>
            <View style={styles.busCardTop}>
              <View style={[styles.routeTag, { backgroundColor: p.routeTag }]}>
                <Text style={styles.routeTagText}>{selected.route_number}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.busRoute, { color: p.text }]}>{detail?.route_name || `Route ${selected.route_number}`}</Text>
                <Text style={styles.busNumber}>{selected.registration_no} · {msAgo(selected.last_update_at)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedId(null)}>
                <Ionicons name="close" size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
            {statusPill(selected)}
            {detail && (
              <>
                {detail.next_stops.length > 0 && (
                  <View style={{ marginTop: 10, gap: 3 }}>
                    <Text style={styles.nextLabel}>NEXT STOPS</Text>
                    {detail.next_stops.map((s) => (
                      <Text key={s.stop_id} style={[styles.nextStop, { color: p.text }]}>
                        {stopLabel({ name: s.name, nameSi: s.name_si })}{s.eta_min != null ? `  ·  ${s.eta_min} min` : ""}
                      </Text>
                    ))}
                  </View>
                )}
                {detail.reservable_seats > 0 && (
                  <Text style={styles.seats}>{detail.available_seats} of {detail.reservable_seats} reservable seats free</Text>
                )}
              </>
            )}
          </View>
        </View>
      )}

      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowFilters(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: p.busCard }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>Filter buses</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={p.subText} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetLabel}>ROUTE</Text>
            <View style={styles.sheetChips}>
              {[null, ...routes].map((r) => {
                const active = filterRoute === r;
                const color = r ? routeColor(r) : "#1a3cff";
                const n = buses.filter((b) => (!r || b.route_number === r) && matchesStatus(b, filterStatus)).length;
                return (
                  <TouchableOpacity
                    key={r ?? "all"}
                    style={[styles.sheetChip, { backgroundColor: p.chip, borderColor: p.chipBorder }, active && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setFilterRoute(r)}
                  >
                    <Text style={[styles.sheetChipText, { color: p.chipText }, active && { color: "#fff" }]}>{r ?? "All routes"}</Text>
                    <Text style={[styles.sheetChipCount, active && { color: "rgba(255,255,255,0.8)" }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>STATUS</Text>
            <View style={styles.sheetChips}>
              {STATUS_OPTIONS.map((o) => {
                const active = filterStatus === o.key;
                const n = buses.filter((b) => matchesRoute(b) && matchesStatus(b, o.key)).length;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.sheetChip, { backgroundColor: p.chip, borderColor: p.chipBorder }, active && { backgroundColor: "#1a3cff", borderColor: "#1a3cff" }]}
                    onPress={() => setFilterStatus(o.key)}
                  >
                    <Text style={[styles.sheetChipText, { color: p.chipText }, active && { color: "#fff" }]}>{o.label}</Text>
                    <Text style={[styles.sheetChipCount, active && { color: "rgba(255,255,255,0.8)" }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sheetFoot}>
              <TouchableOpacity style={[styles.sheetReset, { borderColor: p.chipBorder }]} onPress={resetFilters} disabled={activeFilters === 0}>
                <Text style={[styles.sheetResetText, { color: activeFilters ? p.text : p.subText }]}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetApply} onPress={() => setShowFilters(false)}>
                <Text style={styles.sheetApplyText}>Show {visible.length} bus{visible.length !== 1 ? "es" : ""}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.bottomNav, { backgroundColor: p.bottomNav, borderTopColor: p.bottomNavBorder }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color={p.subText} />
          <Text style={[styles.navText, { color: p.subText }]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="map" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Live Map</Text>
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
  filterBadge: { position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#1a3cff", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(10,14,40,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#d0d3e0", marginBottom: 12 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: "bold" },
  sheetLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "#999", marginTop: 14, marginBottom: 8 },
  sheetChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  sheetChipText: { fontSize: 13, fontWeight: "600" },
  sheetChipCount: { fontSize: 12, color: "#999", fontWeight: "600" },
  sheetFoot: { flexDirection: "row", gap: 10, marginTop: 22 },
  sheetReset: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sheetResetText: { fontSize: 14, fontWeight: "600" },
  sheetApply: { flex: 1, backgroundColor: "#1a3cff", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  sheetApplyText: { color: "#fff", fontSize: 15, fontWeight: "bold" },

  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10, zIndex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  banner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#f44336", paddingVertical: 6 },
  bannerText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  filterRow: { paddingBottom: 10, zIndex: 1 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: "700" },

  map: { flex: 1 },
  mapWeb: { height: 90 },
  webList: { flex: 1 },
  webRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12 },

  busMarker: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  liveIndicator: { position: "absolute", top: 160, right: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4caf50" },
  liveText: { fontSize: 12, fontWeight: "600" },

  busCard: { position: "absolute", bottom: 90, left: 20, right: 20, borderRadius: 16, overflow: "hidden", flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  busCardAccent: { width: 5 },
  busCardBody: { flex: 1, padding: 16 },
  busCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routeTag: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minWidth: 44, alignItems: "center" },
  routeTagText: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  busRoute: { fontSize: 15, fontWeight: "bold" },
  busNumber: { fontSize: 12, color: "#888", marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  nextLabel: { fontSize: 10, fontWeight: "700", color: "#aaa", letterSpacing: 1 },
  nextStop: { fontSize: 13 },
  seats: { fontSize: 12, color: "#4caf50", fontWeight: "600", marginTop: 8 },

  bottomNav: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10, paddingBottom: 24 },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText: { fontSize: 11 },
});
