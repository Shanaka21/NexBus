import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { API_URL } from "./config";

type Bus = {
  id: string;
  route: string;
  destination: string;
  status: string;
};

export default function RoutesScreen() {
  const [activeTab, setActiveTab] = useState("All Routes");
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const tabs = ["All Routes", "Favorites", "Nearby"];

  useEffect(() => {
    fetch(`${API_URL}/buses`)
      .then((res) => res.json())
      .then((data) => {
        const mapped = data.map((item: any) => ({
          id: item.id,
          route: item.route_number,
          destination: item.end_point || item.route_number,
          status: item.status === "delayed" ? "DELAYED" : "ON TIME",
        }));
        setBuses(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#1a1a4e" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Active Buses Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Buses</Text>
        <View style={styles.liveTag}>
          <Text style={styles.liveTagText}>Live Updates</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={buses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No buses available right now.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.busCard}>
              <View style={styles.busCardTop}>
                <View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === "ON TIME" ? "#e8f5e9" : "#fff3e0",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            item.status === "ON TIME" ? "#4caf50" : "#ff9800",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            item.status === "ON TIME" ? "#4caf50" : "#ff9800",
                        },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                  <Text style={styles.busRoute}>
                    {item.route} - {item.destination}
                  </Text>
                  <View style={styles.etaRow}>
                    <Ionicons name="time-outline" size={14} color="#888" />
                    <Text style={styles.etaText}>Live tracking</Text>
                  </View>
                </View>
                <View style={styles.busImageBox}>
                  <Ionicons name="bus" size={28} color="#1a3cff" />
                </View>
              </View>

              <View style={styles.busCardBottom}>
                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() => router.push("/map")}
                >
                  <Ionicons name="location" size={16} color="#fff" />
                  <Text style={styles.trackButtonText}>Track Live</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.starButton}>
                  <Ionicons name="star-outline" size={20} color="#888" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/home")}
        >
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="bus" size={22} color="#1a3cff" />
          <Text style={[styles.navText, { color: "#1a3cff" }]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/map")}
        >
          <Ionicons name="map-outline" size={22} color="#888" />
          <Text style={styles.navText}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/bookings" as any)}
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
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a4e" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: { marginRight: 24, paddingBottom: 10 },
  tabText: { fontSize: 15, color: "#888" },
  tabTextActive: { color: "#1a3cff", fontWeight: "600" },
  tabUnderline: {
    height: 2,
    backgroundColor: "#1a3cff",
    borderRadius: 2,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a4e" },
  liveTag: {
    backgroundColor: "#f0f0f5",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveTagText: { fontSize: 12, color: "#555" },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyText: { textAlign: "center", color: "#aaa", marginTop: 40, fontSize: 15 },
  busCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  busCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  busRoute: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a4e",
    marginBottom: 4,
  },
  etaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  etaText: { fontSize: 13, color: "#888" },
  busImageBox: {
    width: 56,
    height: 56,
    backgroundColor: "#f0f4ff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  busCardBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  trackButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a3cff",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  trackButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  starButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNav: {
    flexDirection: "row",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 10,
    paddingBottom: 24,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navText: { fontSize: 11, color: "#888" },
});
