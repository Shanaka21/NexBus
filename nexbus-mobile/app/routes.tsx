import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { API_URL } from "./config";

const FAVORITES_KEY = "nexbus_favorite_routes";

type Bus = {
  id: string;
  route: string;
  destination: string;
  from: string;
  status: string;
};

export default function RoutesScreen() {
  const [activeTab, setActiveTab] = useState("All Routes");
  const [buses, setBuses]         = useState<Bus[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);

  // Nearby state
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [locationLabel, setLocationLabel]   = useState("");

  const router = useRouter();
  const tabs = ["All Routes", "Favorites", "Nearby"];

  // Load buses
  useEffect(() => {
    fetch(`${API_URL}/buses`)
      .then((r) => r.json())
      .then((data) => {
        const mapped: Bus[] = data.map((item: any) => ({
          id:          item.id,
          route:       item.route_number,
          destination: item.end_point   || item.route_number,
          from:        item.start_point || "—",
          status:      item.status === "delayed" ? "DELAYED" : "ON TIME",
        }));
        setBuses(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load favorites from storage
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
        if (raw) setFavorites(new Set(JSON.parse(raw)));
      });
    }, [])
  );

  const saveFavorites = async (next: Set<string>) => {
    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else              next.add(id);
    saveFavorites(next);
  };

  // Request location for Nearby tab
  const requestNearby = async () => {
    setLocationStatus("loading");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus("denied");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const [geo] = await Location.reverseGeocodeAsync(loc.coords);
    const label = geo?.city || geo?.subregion || geo?.region || "your area";
    setLocationLabel(label);
    setLocationStatus("granted");
  };

  useEffect(() => {
    if (activeTab === "Nearby" && locationStatus === "idle") {
      requestNearby();
    }
  }, [activeTab]);

  // Data to show per tab
  const displayBuses =
    activeTab === "Favorites"
      ? buses.filter((b) => favorites.has(b.id))
      : buses;

  const renderEmpty = () => {
    if (activeTab === "Favorites") {
      return (
        <View style={styles.emptyBox}>
          <Ionicons name="star-outline" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No Favourites Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the ★ on any route to save it here
          </Text>
        </View>
      );
    }
    return <Text style={styles.emptyText}>No buses available right now.</Text>;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/home")}>
          <Ionicons name="arrow-back" size={24} color="#1a1a4e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NexBus</Text>
        <TouchableOpacity
          style={styles.smartBtn}
          onPress={() => router.push("/smartsuggestions" as any)}
        >
          <Ionicons name="bulb-outline" size={14} color="#1a3cff" />
          <Text style={styles.smartBtnText}>Smart</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {activeTab === "Favorites" ? "Saved Routes" :
           activeTab === "Nearby"   ? "Nearby Routes" :
                                      "Active Buses"}
        </Text>
        {activeTab === "All Routes" && (
          <View style={styles.liveTag}>
            <Text style={styles.liveTagText}>Live Updates</Text>
          </View>
        )}
        {activeTab === "Favorites" && (
          <View style={styles.countTag}>
            <Text style={styles.countTagText}>{favorites.size} saved</Text>
          </View>
        )}
        {activeTab === "Nearby" && locationStatus === "granted" && (
          <View style={styles.locationTag}>
            <Ionicons name="location" size={12} color="#1a3cff" />
            <Text style={styles.locationTagText}>{locationLabel}</Text>
          </View>
        )}
      </View>

      {/* Nearby permission states */}
      {activeTab === "Nearby" && locationStatus === "loading" && (
        <View style={styles.nearbyBox}>
          <ActivityIndicator size="large" color="#1a3cff" />
          <Text style={styles.nearbyText}>Getting your location…</Text>
        </View>
      )}

      {activeTab === "Nearby" && locationStatus === "denied" && (
        <View style={styles.nearbyBox}>
          <Ionicons name="location-outline" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>Location Access Denied</Text>
          <Text style={styles.emptySubtitle}>
            Enable location permission in Settings to see nearby routes
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={requestNearby}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bus list — shown for All Routes, Favorites, and Nearby (after permission granted) */}
      {(activeTab !== "Nearby" || locationStatus === "granted") && (
        loading ? (
          <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={displayBuses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={renderEmpty()}
            renderItem={({ item }) => (
              <BusCard
                item={item}
                isFav={favorites.has(item.id)}
                onToggleFav={() => toggleFavorite(item.id)}
                onTrack={() => router.push("/map")}
              />
            )}
          />
        )
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="bus" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/map")}>
          <Ionicons name="map-outline" size={22} color="#888" />
          <Text style={styles.navText}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/bookings" as any)}>
          <Ionicons name="ticket-outline" size={22} color="#888" />
          <Text style={styles.navText}>Bookings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BusCard({
  item, isFav, onToggleFav, onTrack,
}: {
  item: Bus; isFav: boolean;
  onToggleFav: () => void; onTrack: () => void;
}) {
  const onTime = item.status === "ON TIME";
  return (
    <View style={styles.busCard}>
      <View style={styles.busCardTop}>
        <View style={{ flex: 1 }}>
          <View style={[styles.statusBadge, { backgroundColor: onTime ? "#e8f5e9" : "#fff3e0" }]}>
            <View style={[styles.statusDot, { backgroundColor: onTime ? "#4caf50" : "#ff9800" }]} />
            <Text style={[styles.statusText, { color: onTime ? "#4caf50" : "#ff9800" }]}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.busRoute}>{item.route} · {item.destination}</Text>
          <View style={styles.etaRow}>
            <Ionicons name="location-outline" size={13} color="#888" />
            <Text style={styles.etaText}>{item.from} → {item.destination}</Text>
          </View>
        </View>
        <View style={styles.busImageBox}>
          <Ionicons name="bus" size={28} color="#1a3cff" />
        </View>
      </View>

      <View style={styles.busCardBottom}>
        <TouchableOpacity style={styles.trackButton} onPress={onTrack}>
          <Ionicons name="location" size={16} color="#fff" />
          <Text style={styles.trackButtonText}>Track Live</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.starButton} onPress={onToggleFav}>
          <Ionicons
            name={isFav ? "star" : "star-outline"}
            size={20}
            color={isFav ? "#f5a623" : "#888"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12, backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a4e" },
  smartBtn:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0f4ff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#c8d6ff" },
  smartBtnText: { fontSize: 12, fontWeight: "700", color: "#1a3cff" },

  tabRow: {
    flexDirection: "row", paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  tab:           { marginRight: 24, paddingBottom: 10 },
  tabText:       { fontSize: 15, color: "#888" },
  tabTextActive: { color: "#1a3cff", fontWeight: "600" },
  tabUnderline:  { height: 2, backgroundColor: "#1a3cff", borderRadius: 2, marginTop: 4 },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a4e" },
  liveTag:      { backgroundColor: "#f0f0f5", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  liveTagText:  { fontSize: 12, color: "#555" },
  countTag:     { backgroundColor: "#fff3e0", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  countTagText: { fontSize: 12, color: "#f5a623", fontWeight: "600" },
  locationTag:  { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0f4ff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  locationTagText: { fontSize: 12, color: "#1a3cff", fontWeight: "600" },

  list: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: "center", color: "#aaa", marginTop: 40, fontSize: 15 },

  emptyBox: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTitle:    { fontSize: 17, fontWeight: "bold", color: "#1a1a4e", marginTop: 6 },
  emptySubtitle: { fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 20 },

  nearbyBox: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 30 },
  nearbyText:    { fontSize: 14, color: "#888" },
  retryBtn:      { marginTop: 10, backgroundColor: "#1a3cff", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText:  { color: "#fff", fontWeight: "600", fontSize: 14 },

  busCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#eee",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  busCardTop:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  statusBadge:   { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 6 },
  statusDot:     { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText:    { fontSize: 11, fontWeight: "bold" },
  busRoute:      { fontSize: 17, fontWeight: "bold", color: "#1a1a4e", marginBottom: 4 },
  etaRow:        { flexDirection: "row", alignItems: "center", gap: 4 },
  etaText:       { fontSize: 12, color: "#888" },
  busImageBox:   { width: 56, height: 56, backgroundColor: "#f0f4ff", borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  busCardBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackButton:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#1a3cff", borderRadius: 12, paddingVertical: 12, gap: 6 },
  trackButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  starButton:    { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#eee", alignItems: "center", justifyContent: "center" },

  bottomNav: {
    flexDirection: "row", position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee",
    paddingVertical: 10, paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText:  { fontSize: 11, color: "#888" },
});
