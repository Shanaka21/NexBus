import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getUserId } from "./userSession";
import { API_URL } from "./config";

type Notif = {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const STATIC_NOTIFS: Notif[] = [
  {
    id: "sys1",
    icon: "megaphone-outline",
    iconColor: "#1a3cff",
    iconBg: "#f0f4ff",
    title: "Welcome to NexBus!",
    body: "Track buses, book rides, and travel smarter across Sri Lanka.",
    time: "Just now",
    read: false,
  },
  {
    id: "sys2",
    icon: "information-circle-outline",
    iconColor: "#ff9800",
    iconBg: "#fff3e0",
    title: "Service Update",
    body: "Route 138 (Fort – Maharagama) now has increased frequency on weekdays.",
    time: "2 hrs ago",
    read: true,
  },
  {
    id: "sys3",
    icon: "shield-checkmark-outline",
    iconColor: "#4caf50",
    iconBg: "#e8f5e9",
    title: "Account Verified",
    body: "Your NexBus passenger account is active and ready to use.",
    time: "Yesterday",
    read: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    const uid = getUserId();
    if (!uid) { setNotifs(STATIC_NOTIFS); return; }

    fetch(`${API_URL}/bookings?user_id=${uid}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) { setNotifs(STATIC_NOTIFS); return; }

        const bookingNotifs: Notif[] = data.slice(0, 5).map((b) => {
          const isConfirmed  = b.status === "confirmed";
          const isCancelled  = b.status === "cancelled";
          const isCompleted  = b.status === "completed";
          return {
            id: `booking-${b.id}`,
            icon: isConfirmed  ? "checkmark-circle-outline"
                : isCancelled  ? "close-circle-outline"
                : "checkmark-done-outline",
            iconColor: isConfirmed  ? "#4caf50"
                     : isCancelled  ? "#f44336"
                     : "#1a3cff",
            iconBg:    isConfirmed  ? "#e8f5e9"
                     : isCancelled  ? "#ffebee"
                     : "#e3f2fd",
            title: isConfirmed  ? "Booking Confirmed"
                 : isCancelled  ? "Booking Cancelled"
                 : "Trip Completed",
            body: `Route ${b.route} · ${b.from} → ${b.to} · ${b.time} · ${b.fare}`,
            time: b.date,
            read: isCompleted || isCancelled,
          };
        });

        setNotifs([...bookingNotifs, ...STATIC_NOTIFS]);
      })
      .catch(() => setNotifs(STATIC_NOTIFS));
  }, []);

  const unreadCount = notifs.filter((n) => !n.read).length;

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
        <View style={{ width: 24 }} />
      </LinearGradient>

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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            activeOpacity={0.85}
            onPress={() => {
              if (!item.read) {
                setNotifs((prev) =>
                  prev.map((n) => n.id === item.id ? { ...n, read: true } : n)
                );
              }
            }}
          >
            {!item.read && <View style={styles.unreadDot} />}
            <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardTime}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
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
  headerBadge: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
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
  unreadDot: {
    position: "absolute", top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#1a3cff",
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a4e", marginBottom: 4 },
  cardBody:  { fontSize: 13, color: "#666", lineHeight: 18, marginBottom: 6 },
  cardTime:  { fontSize: 11, color: "#aaa" },
  emptyBox:  { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: "#aaa" },
});
