import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";

type BusPin = {
  id: string;
  route: string;
  from: string;
  to: string;
  status: "ON TIME" | "DELAYED";
  busNumber: string;
  coordinate: { latitude: number; longitude: number };
};

// Buses placed at realistic midpoints along actual Sri Lanka roads
const BUS_LOCATIONS: BusPin[] = [
  // Route 48 – Fort ↔ Kandy (A1 road, ~2 buses en route)
  {
    id: "b48a", route: "48", busNumber: "NC-4801",
    from: "Fort", to: "Kandy", status: "ON TIME",
    coordinate: { latitude: 7.2487, longitude: 80.5313 }, // Kadugannawa
  },
  {
    id: "b48b", route: "48", busNumber: "NC-4802",
    from: "Fort", to: "Kandy", status: "DELAYED",
    coordinate: { latitude: 7.0748, longitude: 80.2144 }, // Kegalle
  },

  // Route 17 – Pettah ↔ Kottawa (via Nugegoda, Kohuwala)
  {
    id: "b17a", route: "17", busNumber: "NC-1701",
    from: "Pettah", to: "Kottawa", status: "ON TIME",
    coordinate: { latitude: 6.8590, longitude: 79.9012 }, // Kohuwala
  },
  {
    id: "b17b", route: "17", busNumber: "NC-1703",
    from: "Pettah", to: "Kottawa", status: "DELAYED",
    coordinate: { latitude: 6.8720, longitude: 79.8990 }, // Nugegoda
  },

  // Route 05 – Fort ↔ Moratuwa (Galle Road south)
  {
    id: "b05a", route: "05", busNumber: "NC-0501",
    from: "Fort", to: "Moratuwa", status: "ON TIME",
    coordinate: { latitude: 6.8521, longitude: 79.8650 }, // Dehiwala
  },
  {
    id: "b05b", route: "05", busNumber: "NC-0502",
    from: "Fort", to: "Moratuwa", status: "ON TIME",
    coordinate: { latitude: 6.7736, longitude: 79.8828 }, // Moratuwa
  },

  // Route 01 – Fort ↔ Galle (Southern Expressway corridor)
  {
    id: "b01a", route: "01", busNumber: "NC-0101",
    from: "Fort", to: "Galle", status: "ON TIME",
    coordinate: { latitude: 6.5873, longitude: 79.9607 }, // Kalutara
  },
  {
    id: "b01b", route: "01", busNumber: "NC-0102",
    from: "Fort", to: "Galle", status: "DELAYED",
    coordinate: { latitude: 6.2672, longitude: 80.0670 }, // Ambalangoda
  },

  // Route 06 – Fort ↔ Dehiwala (Galle Road near-city)
  {
    id: "b06a", route: "06", busNumber: "NC-0601",
    from: "Fort", to: "Dehiwala", status: "ON TIME",
    coordinate: { latitude: 6.8310, longitude: 79.8680 }, // Mount Lavinia
  },

  // Route 138 – Fort ↔ Maharagama → Homagama
  {
    id: "b138a", route: "138", busNumber: "NC-1381",
    from: "Fort", to: "Maharagama", status: "ON TIME",
    coordinate: { latitude: 6.8484, longitude: 79.9262 }, // Maharagama
  },
  {
    id: "b138b", route: "138", busNumber: "NC-1382",
    from: "Fort", to: "Homagama", status: "ON TIME",
    coordinate: { latitude: 6.8398, longitude: 80.0022 }, // Homagama
  },

  // Route 100 – Fort ↔ Kurunegala (A10 road)
  {
    id: "b100a", route: "100", busNumber: "NC-1001",
    from: "Fort", to: "Kurunegala", status: "ON TIME",
    coordinate: { latitude: 7.0533, longitude: 80.0955 }, // Nittambuwa
  },
  {
    id: "b100b", route: "100", busNumber: "NC-1002",
    from: "Fort", to: "Kurunegala", status: "DELAYED",
    coordinate: { latitude: 7.2877, longitude: 80.2346 }, // Warakapola
  },

  // Route 187 – Fort ↔ Battaramulla
  {
    id: "b187a", route: "187", busNumber: "NC-1871",
    from: "Fort", to: "Battaramulla", status: "ON TIME",
    coordinate: { latitude: 6.9079, longitude: 79.9010 }, // Rajagiriya
  },

  // Route 14 – Pettah ↔ Kelaniya
  {
    id: "b14a", route: "14", busNumber: "NC-1401",
    from: "Pettah", to: "Kelaniya", status: "ON TIME",
    coordinate: { latitude: 6.9548, longitude: 79.9224 }, // Kelaniya
  },

  // Route 122 – Pettah ↔ Avissawella
  {
    id: "b122a", route: "122", busNumber: "NC-1221",
    from: "Pettah", to: "Avissawella", status: "ON TIME",
    coordinate: { latitude: 6.9382, longitude: 79.9901 }, // Kaduwela area
  },
  {
    id: "b122b", route: "122", busNumber: "NC-1222",
    from: "Pettah", to: "Avissawella", status: "DELAYED",
    coordinate: { latitude: 6.9491, longitude: 80.2135 }, // Avissawella
  },

  // Route 400 – Fort ↔ Negombo
  {
    id: "b400a", route: "400", busNumber: "NC-4001",
    from: "Fort", to: "Negombo", status: "ON TIME",
    coordinate: { latitude: 7.0692, longitude: 79.9049 }, // Wattala
  },
  {
    id: "b400b", route: "400", busNumber: "NC-4002",
    from: "Fort", to: "Negombo", status: "DELAYED",
    coordinate: { latitude: 7.2084, longitude: 79.8374 }, // Negombo
  },
];

const ROUTE_COLORS: Record<string, string> = {
  "48": "#e53935", "17": "#8e24aa", "05": "#1e88e5",
  "01": "#43a047", "06": "#fb8c00", "138": "#1a3cff",
  "100": "#d81b60", "187": "#00897b", "14": "#6d4c41",
  "122": "#f4511e", "400": "#039be5",
};

export default function MapScreen() {
  const router = useRouter();
  const [selectedBus, setSelectedBus] = useState<BusPin | null>(null);
  const [filterRoute, setFilterRoute] = useState<string | null>(null);

  const uniqueRoutes = [...new Set(BUS_LOCATIONS.map((b) => b.route))].sort(
    (a, b) => Number(a) - Number(b)
  );

  const visibleBuses = filterRoute
    ? BUS_LOCATIONS.filter((b) => b.route === filterRoute)
    : BUS_LOCATIONS;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a4e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Map</Text>
        <TouchableOpacity onPress={() => setFilterRoute(null)}>
          <Ionicons
            name={filterRoute ? "close-circle" : "options-outline"}
            size={24}
            color={filterRoute ? "#1a3cff" : "#1a1a4e"}
          />
        </TouchableOpacity>
      </View>

      {/* Route Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {uniqueRoutes.map((r) => {
            const active = filterRoute === r;
            const color = ROUTE_COLORS[r] || "#1a3cff";
            return (
              <TouchableOpacity
                key={r}
                style={[styles.filterChip, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => setFilterRoute(active ? null : r)}
              >
                <Text style={[styles.filterChipText, active && { color: "#fff" }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Apple Maps (default iOS provider — no PROVIDER_GOOGLE) */}
      <MapView
        style={styles.map}
        mapType="mutedStandard"
        initialRegion={{
          latitude: 6.9271,
          longitude: 79.8612,
          latitudeDelta: 0.22,
          longitudeDelta: 0.22,
        }}
        showsUserLocation
        showsMyLocationButton
        showsCompass
        showsScale
      >
        {visibleBuses.map((bus) => {
          const color = ROUTE_COLORS[bus.route] || "#1a3cff";
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
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>
          {visibleBuses.length} bus{visibleBuses.length !== 1 ? "es" : ""} live
        </Text>
      </View>

      {/* Selected Bus Card */}
      {selectedBus && (
        <View style={styles.busCard}>
          <View style={[styles.busCardAccent, { backgroundColor: ROUTE_COLORS[selectedBus.route] || "#1a3cff" }]} />
          <View style={styles.busCardBody}>
            <View style={styles.busCardTop}>
              <View style={styles.routeTag}>
                <Text style={styles.routeTagText}>{selectedBus.route}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.busRoute}>{selectedBus.from} → {selectedBus.to}</Text>
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
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color="#888" />
          <Text style={styles.navText}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="map" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/bookings")}>
          <Ionicons name="ticket-outline" size={22} color="#888" />
          <Text style={styles.navText}>Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 10,
    backgroundColor: "#fff", zIndex: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a4e" },

  filterRow: { backgroundColor: "#fff", paddingBottom: 10, zIndex: 1 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#e0e0e0", backgroundColor: "#fff",
  },
  filterChipText: { fontSize: 13, fontWeight: "700", color: "#555" },

  map: { flex: 1 },

  busMarker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },

  liveIndicator: {
    position: "absolute", top: 160, right: 16,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4caf50" },
  liveText: { fontSize: 12, fontWeight: "600", color: "#1a1a4e" },

  busCard: {
    position: "absolute", bottom: 90, left: 20, right: 20,
    backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  busCardAccent: { width: 5 },
  busCardBody: { flex: 1, padding: 16 },
  busCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routeTag: {
    backgroundColor: "#f0f4ff", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 44, alignItems: "center",
  },
  routeTagText: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  busRoute: { fontSize: 15, fontWeight: "bold", color: "#1a1a4e" },
  busNumber: { fontSize: 12, color: "#888", marginTop: 2 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },

  bottomNav: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#eee",
    paddingVertical: 10, paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText: { fontSize: 11, color: "#888" },
});
