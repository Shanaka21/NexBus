import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";

const BUS_LOCATIONS = [
  {
    id: "1",
    route: "138",
    destination: "Maharagama",
    status: "ON TIME",
    coordinate: { latitude: 6.7955, longitude: 79.9012 },
  },
  {
    id: "2",
    route: "122",
    destination: "Avissawella",
    status: "DELAYED",
    coordinate: { latitude: 6.81, longitude: 79.8897 },
  },
  {
    id: "3",
    route: "190",
    destination: "Meegoda",
    status: "ON TIME",
    coordinate: { latitude: 6.78, longitude: 79.92 },
  },
];

export default function MapScreen() {
  const router = useRouter();
  const [selectedBus, setSelectedBus] = useState<any>(null);

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
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color="#1a1a4e" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 6.7955,
          longitude: 79.9012,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {BUS_LOCATIONS.map((bus) => (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            onPress={() => setSelectedBus(bus)}
          >
            <View
              style={[
                styles.busMarker,
                {
                  backgroundColor:
                    bus.status === "ON TIME" ? "#1a3cff" : "#ff9800",
                },
              ]}
            >
              <Ionicons name="bus" size={16} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Selected Bus Card */}
      {selectedBus && (
        <View style={styles.busCard}>
          <View style={styles.busCardLeft}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    selectedBus.status === "ON TIME" ? "#4caf50" : "#ff9800",
                },
              ]}
            />
            <View>
              <Text style={styles.busRoute}>
                Route {selectedBus.route} - {selectedBus.destination}
              </Text>
              <Text style={styles.busStatus}>{selectedBus.status}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeCard}
            onPress={() => setSelectedBus(null)}
          >
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </View>
      )}

      {/* Live indicator */}
      <View style={styles.liveIndicator}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live Tracking</Text>
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/home")}
        >
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/routes")}
        >
          <Ionicons name="bus-outline" size={22} color="#888" />
          <Text style={styles.navText}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="map" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/bookings")}
        >
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: "#fff",
    zIndex: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a4e" },
  map: {
    flex: 1,
  },
  busMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  busCard: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  busCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  busRoute: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a4e",
  },
  busStatus: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  closeCard: {
    padding: 4,
  },
  liveIndicator: {
    position: "absolute",
    top: 110,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4caf50",
  },
  liveText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a4e",
  },
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
