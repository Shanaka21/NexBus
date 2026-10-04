import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson } from "../../lib/api";
import { clearSession, getUserName } from "../../lib/userSession";
import { clockTime } from "../../lib/format";

type Trip = {
  id: string; route_id: string; route_number: string; registration_no: string; status: string;
  scheduled_departure: number; delay_minutes: number; reservable_seats: number; available_seats: number;
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: "Scheduled", color: "#1a3cff", bg: "#e3f2fd" },
  running:   { label: "Running",   color: "#4caf50", bg: "#e8f5e9" },
  completed: { label: "Completed", color: "#9e9e9e", bg: "#eeeeee" },
  cancelled: { label: "Cancelled", color: "#f44336", bg: "#ffebee" },
};

// Sri Lanka calendar date (UTC+05:30) as YYYY-MM-DD
const colomboToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

export default function DriverTripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routeNames, setRouteNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([apiJson(`/trips?date=${colomboToday()}`), apiJson("/routes")]);
      if (t.ok && Array.isArray(t.data)) setTrips(t.data);
      else Alert.alert("Error", t.data?.error || "Could not load your trips.");
      if (r.ok && Array.isArray(r.data)) {
        setRouteNames(Object.fromEntries(r.data.map((x: any) => [x.id, `${x.start_point} → ${x.end_point}`])));
      }
    } catch {
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => { clearSession(); router.replace("/login"); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <View>
          <Text style={styles.headerSub}>Driver mode</Text>
          <Text style={styles.headerTitle}>{getUserName() || "Driver"}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Ionicons name="log-out-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <Text style={styles.sectionTitle}>Today&apos;s trips</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No trips assigned to you today.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const s = STATUS[item.status] || STATUS.scheduled;
            const booked = item.reservable_seats - item.available_seats;
            return (
              <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: "/driver/trip", params: { id: item.id } } as any)}>
                <View style={styles.cardTop}>
                  <View style={styles.routeBox}><Text style={styles.routeNumber}>{item.route_number}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{routeNames[item.route_id] || `Route ${item.route_number}`}</Text>
                    <Text style={styles.cardSub}>Bus {item.registration_no}</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: s.bg }]}>
                    <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.meta}><Ionicons name="time-outline" size={14} color="#888" /><Text style={styles.metaText}>{clockTime(item.scheduled_departure)}</Text></View>
                  {item.reservable_seats > 0 && (
                    <View style={styles.meta}><Ionicons name="people-outline" size={14} color="#888" /><Text style={styles.metaText}>{booked} / {item.reservable_seats} seats booked</Text></View>
                  )}
                  {item.delay_minutes >= 10 && (
                    <View style={styles.meta}><Ionicons name="alert-circle-outline" size={14} color="#ff9800" /><Text style={[styles.metaText, { color: "#ff9800" }]}>{item.delay_minutes} min late</Text></View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 22 },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600", letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#1a1a4e", paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  routeBox: { minWidth: 48, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f0f4ff", alignItems: "center" },
  routeNumber: { fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a4e" },
  cardSub: { fontSize: 12, color: "#888", marginTop: 2 },
  chip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "700" },
  cardBottom: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, color: "#666" },
  empty: { alignItems: "center", paddingTop: 70, gap: 12 },
  emptyText: { fontSize: 15, color: "#aaa" },
});
