import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "./themeContext";

type BusPin = {
  id: string;
  route: string;
  from: string;
  to: string;
  status: "ON TIME" | "DELAYED";
  busNumber: string;
  coordinate: { latitude: number; longitude: number };
};

const BUS_LOCATIONS: BusPin[] = [
  { id: "b48a",  route: "48",  busNumber: "NC-4801", from: "Fort",   to: "Kandy",       status: "ON TIME", coordinate: { latitude: 7.2487, longitude: 80.5313 } },
  { id: "b48b",  route: "48",  busNumber: "NC-4802", from: "Fort",   to: "Kandy",       status: "DELAYED", coordinate: { latitude: 7.0748, longitude: 80.2144 } },
  { id: "b17a",  route: "17",  busNumber: "NC-1701", from: "Pettah", to: "Kottawa",     status: "ON TIME", coordinate: { latitude: 6.8590, longitude: 79.9012 } },
  { id: "b17b",  route: "17",  busNumber: "NC-1703", from: "Pettah", to: "Kottawa",     status: "DELAYED", coordinate: { latitude: 6.8720, longitude: 79.8990 } },
  { id: "b05a",  route: "05",  busNumber: "NC-0501", from: "Fort",   to: "Moratuwa",    status: "ON TIME", coordinate: { latitude: 6.8521, longitude: 79.8650 } },
  { id: "b05b",  route: "05",  busNumber: "NC-0502", from: "Fort",   to: "Moratuwa",    status: "ON TIME", coordinate: { latitude: 6.7736, longitude: 79.8828 } },
  { id: "b01a",  route: "01",  busNumber: "NC-0101", from: "Fort",   to: "Galle",       status: "ON TIME", coordinate: { latitude: 6.5873, longitude: 79.9607 } },
  { id: "b01b",  route: "01",  busNumber: "NC-0102", from: "Fort",   to: "Galle",       status: "DELAYED", coordinate: { latitude: 6.2672, longitude: 80.0670 } },
  { id: "b06a",  route: "06",  busNumber: "NC-0601", from: "Fort",   to: "Dehiwala",    status: "ON TIME", coordinate: { latitude: 6.8310, longitude: 79.8680 } },
  { id: "b138a", route: "138", busNumber: "NC-1381", from: "Fort",   to: "Maharagama",  status: "ON TIME", coordinate: { latitude: 6.8484, longitude: 79.9262 } },
  { id: "b138b", route: "138", busNumber: "NC-1382", from: "Fort",   to: "Homagama",    status: "ON TIME", coordinate: { latitude: 6.8398, longitude: 80.0022 } },
  { id: "b100a", route: "100", busNumber: "NC-1001", from: "Fort",   to: "Kurunegala",  status: "ON TIME", coordinate: { latitude: 7.0533, longitude: 80.0955 } },
  { id: "b100b", route: "100", busNumber: "NC-1002", from: "Fort",   to: "Kurunegala",  status: "DELAYED", coordinate: { latitude: 7.2877, longitude: 80.2346 } },
  { id: "b187a", route: "187", busNumber: "NC-1871", from: "Fort",   to: "Battaramulla",status: "ON TIME", coordinate: { latitude: 6.9079, longitude: 79.9010 } },
  { id: "b14a",  route: "14",  busNumber: "NC-1401", from: "Pettah", to: "Kelaniya",    status: "ON TIME", coordinate: { latitude: 6.9548, longitude: 79.9224 } },
  { id: "b122a", route: "122", busNumber: "NC-1221", from: "Pettah", to: "Avissawella", status: "ON TIME", coordinate: { latitude: 6.9382, longitude: 79.9901 } },
  { id: "b122b", route: "122", busNumber: "NC-1222", from: "Pettah", to: "Avissawella", status: "DELAYED", coordinate: { latitude: 6.9491, longitude: 80.2135 } },
  { id: "b400a", route: "400", busNumber: "NC-4001", from: "Fort",   to: "Negombo",     status: "ON TIME", coordinate: { latitude: 7.0692, longitude: 79.9049 } },
  { id: "b400b", route: "400", busNumber: "NC-4002", from: "Fort",   to: "Negombo",     status: "DELAYED", coordinate: { latitude: 7.2084, longitude: 79.8374 } },
];

const ROUTE_COLORS: Record<string, string> = {
  "48": "#e53935", "17": "#8e24aa", "05": "#1e88e5",
  "01": "#43a047", "06": "#fb8c00", "138": "#1a3cff",
  "100": "#d81b60", "187": "#00897b", "14": "#6d4c41",
  "122": "#f4511e", "400": "#039be5",
};

const light = {
  bg:             "#fff",
  header:         "#fff",
  text:           "#1a1a4e",
  filterRow:      "#fff",
  chip:           "#fff",
  chipBorder:     "#e0e0e0",
  chipText:       "#555",
  liveIndicator:  "#fff",
  liveText:       "#1a1a4e",
  busCard:        "#fff",
  routeTag:       "#f0f4ff",
  bottomNav:      "#fff",
  bottomNavBorder:"#eee",
  subText:        "#888",
};

const dark = {
  bg:             "#0d0d1a",
  header:         "#0d0d1a",
  text:           "#dde0ff",
  filterRow:      "#0d0d1a",
  chip:           "#1a1a2e",
  chipBorder:     "#2a2a4e",
  chipText:       "#aaa",
  liveIndicator:  "#1a1a2e",
  liveText:       "#dde0ff",
  busCard:        "#1a1a2e",
  routeTag:       "#1e2250",
  bottomNav:      "#1a1a2e",
  bottomNavBorder:"#2a2a4e",
  subText:        "#888",
};

export default function MapScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [selectedBus, setSelectedBus] = useState<BusPin | null>(null);
  const [filterRoute, setFilterRoute] = useState<string | null>(null);

  const uniqueRoutes = [...new Set(BUS_LOCATIONS.map((b) => b.route))].sort((a, b) => Number(a) - Number(b));
  const visibleBuses = filterRoute ? BUS_LOCATIONS.filter((b) => b.route === filterRoute) : BUS_LOCATIONS;

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: p.header }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={p.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: p.text }]}>Live Map</Text>
        <TouchableOpacity onPress={() => setFilterRoute(null)}>
          <Ionicons
            name={filterRoute ? "close-circle" : "options-outline"}
            size={24}
            color={filterRoute ? "#1a3cff" : p.text}
          />
        </TouchableOpacity>
      </View>

      {/* Route Filter Chips */}
      <View style={[styles.filterRow, { backgroundColor: p.filterRow }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {uniqueRoutes.map((r) => {
            const active = filterRoute === r;
            const color  = ROUTE_COLORS[r] || "#1a3cff";
            return (
              <TouchableOpacity
                key={r}
                style={[styles.filterChip, { backgroundColor: p.chip, borderColor: p.chipBorder }, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setFilterRoute(active ? null : r)}
              >
                <Text style={[styles.filterChipText, { color: p.chipText }, active && { color: "#fff" }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <MapView
        style={styles.map}
        mapType="mutedStandard"
        initialRegion={{ latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.22, longitudeDelta: 0.22 }}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        showsScale
      >
        {visibleBuses.map((bus) => {
          const color     = ROUTE_COLORS[bus.route] || "#1a3cff";
          const isDelayed = bus.status === "DELAYED";
          return (
            <Marker
              key={bus.id}
              coordinate={bus.coordinate}
              onPress={() => setSelectedBus(bus)}
              title={`Route ${bus.route}`}
              description={`${bus.from} → ${bus.to}`}
            >
              <View style={[styles.busMarker, { backgroundColor: isDelayed ? "#ff9800" : color }]}>
                <Ionicons name="bus" size={14} color="#fff" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Live indicator */}
      <View style={[styles.liveIndicator, { backgroundColor: p.liveIndicator }]}>
        <View style={styles.liveDot} />
        <Text style={[styles.liveText, { color: p.liveText }]}>
          {visibleBuses.length} bus{visibleBuses.length !== 1 ? "es" : ""} live
        </Text>
      </View>

      {/* Selected Bus Card */}
      {selectedBus && (
        <View style={[styles.busCard, { backgroundColor: p.busCard }]}>
          <View style={[styles.busCardAccent, { backgroundColor: ROUTE_COLORS[selectedBus.route] || "#1a3cff" }]} />
          <View style={styles.busCardBody}>
            <View style={styles.busCardTop}>
              <View style={[styles.routeTag, { backgroundColor: p.routeTag }]}>
                <Text style={styles.routeTagText}>{selectedBus.route}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.busRoute, { color: p.text }]}>{selectedBus.from} → {selectedBus.to}</Text>
                <Text style={styles.busNumber}>{selectedBus.busNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedBus(null)}>
                <Ionicons name="close" size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
            <View style={[styles.statusPill, { backgroundColor: selectedBus.status === "ON TIME" ? "#e8f5e9" : "#fff3e0" }]}>
              <View style={[styles.statusDot, { backgroundColor: selectedBus.status === "ON TIME" ? "#4caf50" : "#ff9800" }]} />
              <Text style={[styles.statusText, { color: selectedBus.status === "ON TIME" ? "#4caf50" : "#ff9800" }]}>
                {selectedBus.status}
              </Text>
            </View>
          </View>
        </View>
      )}

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
  container:    { flex: 1 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10, zIndex: 1 },
  headerTitle:  { fontSize: 20, fontWeight: "bold" },

  filterRow:      { paddingBottom: 10, zIndex: 1 },
  filterScroll:   { paddingHorizontal: 16, gap: 8 },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: "700" },

  map: { flex: 1 },

  busMarker: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  liveIndicator: { position: "absolute", top: 160, right: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  liveDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4caf50" },
  liveText:      { fontSize: 12, fontWeight: "600" },

  busCard:      { position: "absolute", bottom: 90, left: 20, right: 20, borderRadius: 16, overflow: "hidden", flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  busCardAccent:{ width: 5 },
  busCardBody:  { flex: 1, padding: 16 },
  busCardTop:   { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routeTag:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, minWidth: 44, alignItems: "center" },
  routeTagText: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  busRoute:     { fontSize: 15, fontWeight: "bold" },
  busNumber:    { fontSize: 12, color: "#888", marginTop: 2 },
  statusPill:   { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusDot:    { width: 7, height: 7, borderRadius: 4 },
  statusText:   { fontSize: 12, fontWeight: "700" },

  bottomNav:    { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10, paddingBottom: 24 },
  navItem:      { flex: 1, alignItems: "center", gap: 3 },
  navText:      { fontSize: 11 },
});
