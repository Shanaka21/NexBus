import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getUserId, getUserName, getUserEmail } from "./userSession";
import { API_URL } from "./config";

export default function ProfileScreen() {
  const router = useRouter();
  const name  = getUserName()  || "Guest User";
  const email = getUserEmail() || "—";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  const [stats, setStats] = useState({ total: 0, confirmed: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    const uid = getUserId();
    if (!uid) return;
    fetch(`${API_URL}/bookings?user_id=${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setStats({
          total:     data.length,
          confirmed: data.filter((b) => b.status === "confirmed").length,
          completed: data.filter((b) => b.status === "completed").length,
          cancelled: data.filter((b) => b.status === "cancelled").length,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.emailText}>{email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#1a3cff" />
            <Text style={styles.roleText}>Verified Passenger</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#4caf50" }]}>{stats.confirmed}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#1a3cff" }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#f44336" }]}>{stats.cancelled}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Account Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          {[
            { icon: "person-outline",   label: "Full Name",     value: name },
            { icon: "mail-outline",     label: "Email Address", value: email },
            { icon: "bus-outline",      label: "Account Type",  value: "Passenger" },
            { icon: "location-outline", label: "Region",        value: "Sri Lanka" },
          ].map((item) => (
            <View key={item.label} style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name={item.icon as any} size={18} color="#1a3cff" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/newbooking" as any)}
        >
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={styles.primaryBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="ticket-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Book a Ride</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/bookings")}
        >
          <Ionicons name="time-outline" size={18} color="#1a3cff" />
          <Text style={styles.secondaryBtnText}>View Trip History</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20,
  },
  backBtn: {},
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },

  avatarCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    alignItems: "center", marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#f0f4ff", alignItems: "center",
    justifyContent: "center", marginBottom: 14,
    borderWidth: 3, borderColor: "#1a3cff",
  },
  avatarInitials: { fontSize: 32, fontWeight: "bold", color: "#1a3cff" },
  name:      { fontSize: 20, fontWeight: "bold", color: "#1a1a4e", marginBottom: 4 },
  emailText: { fontSize: 14, color: "#888", marginBottom: 10 },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f0f4ff", paddingHorizontal: 14,
    paddingVertical: 5, borderRadius: 20,
  },
  roleText: { fontSize: 12, color: "#1a3cff", fontWeight: "600" },

  statsCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 10, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statBox:     { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#eee" },
  statNum:     { fontSize: 22, fontWeight: "bold", color: "#1a1a4e" },
  statLabel:   { fontSize: 11, color: "#888", marginTop: 2 },

  section: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#1a1a4e", marginBottom: 14, letterSpacing: 0.3 },
  detailRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
  },
  detailIcon: {
    width: 36, height: 36, backgroundColor: "#f0f4ff", borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  detailContent: { flex: 1 },
  detailLabel:   { fontSize: 12, color: "#aaa", marginBottom: 2 },
  detailValue:   { fontSize: 15, color: "#1a1a4e", fontWeight: "500" },

  primaryBtn: { borderRadius: 14, marginBottom: 10 },
  primaryBtnGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, borderRadius: 14, gap: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", borderRadius: 14, paddingVertical: 16, gap: 10,
    borderWidth: 1, borderColor: "#d0d8ff",
  },
  secondaryBtnText: { color: "#1a3cff", fontSize: 16, fontWeight: "600" },
});
