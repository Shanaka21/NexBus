import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson } from "../lib/api";

type Notif = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: number;
  related_booking_id?: string | null;
};

// Icon, colours and screen to open for each notification type
const STYLE: Record<string, { icon: string; color: string; bg: string }> = {
  booking_confirmed: { icon: "checkmark-circle-outline", color: "#4caf50", bg: "#e8f5e9" },
  booking_cancelled: { icon: "close-circle-outline", color: "#f44336", bg: "#ffebee" },
  booking_expired:   { icon: "time-outline", color: "#9e9e9e", bg: "#eeeeee" },
  payment_failed:    { icon: "card-outline", color: "#f44336", bg: "#ffebee" },
  delay_alert:       { icon: "alert-circle-outline", color: "#ff9800", bg: "#fff3e0" },
  trip_cancelled:    { icon: "bus-outline", color: "#f44336", bg: "#ffebee" },
};
const FALLBACK = { icon: "megaphone-outline", color: "#1a3cff", bg: "#f0f4ff" };

function ago(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiJson("/notifications/me")
        .then(({ ok, data }) => setNotifs(ok && Array.isArray(data) ? data : []))
        .catch(() => setNotifs([]))
        .finally(() => setLoading(false));
    }, [])
  );

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const open = (item: Notif) => {
    if (!item.is_read) {
      setNotifs((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      apiJson(`/notifications/${item.id}/read`, { method: "PATCH" }).catch(() => {});
    }
    if (item.related_booking_id) router.push("/bookings");
  };

  const markAll = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    apiJson("/notifications/read-all", { method: "PATCH" }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={markAll} disabled={unreadCount === 0}>
          <Ionicons name="checkmark-done" size={24} color={unreadCount === 0 ? "rgba(255,255,255,0.4)" : "#fff"} />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const s = STYLE[item.type] || FALLBACK;
            return (
              <TouchableOpacity style={[styles.card, !item.is_read && styles.cardUnread]} activeOpacity={0.85} onPress={() => open(item)}>
                {!item.is_read && <View style={styles.unreadDot} />}
                <View style={[styles.iconBox, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon as any} size={22} color={s.color} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.message}</Text>
                  <Text style={styles.cardTime}>{ago(item.created_at)}</Text>
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
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  headerBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  headerBadgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },

  list: { padding: 16, paddingBottom: 40 },
  card: {
    flexDirection: "row", alignItems: "flex-start",
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 10, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    position: "relative",
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#1a3cff" },
  unreadDot: { position: "absolute", top: 14, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: "#1a3cff" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a4e", marginBottom: 4 },
  cardBody:  { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 6 },
  cardTime:  { fontSize: 11, color: "#aaa" },
  emptyBox:  { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: "#aaa" },
});
