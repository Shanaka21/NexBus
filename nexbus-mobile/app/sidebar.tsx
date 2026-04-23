import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getUserName, getUserEmail, clearSession } from "./userSession";

export default function SidebarScreen() {
  const router = useRouter();
  const name  = getUserName()  || "Guest User";
  const email = getUserEmail() || "Not logged in";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  const menuItems = [
    { icon: "person-outline",        label: "Profile",       onPress: () => router.push("/profile" as any) },
    { icon: "time-outline",          label: "Trip History",  onPress: () => router.push("/bookings") },
    { icon: "star-outline",          label: "Favorites",     onPress: () => router.push("/routes") },
    { icon: "ticket-outline",        label: "My Bookings",   onPress: () => router.push("/bookings") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => router.push("/notifications" as any) },
    { icon: "settings-outline",      label: "Settings",      onPress: () => router.push("/settings" as any) },
    {
      icon: "alert-circle-outline",
      label: "Report Issue",
      onPress: () =>
        Alert.alert(
          "Report an Issue",
          "How would you like to report?",
          [
            {
              text: "Bus Not Arrived",
              onPress: () => Alert.alert("Reported", "Your report has been submitted. Thank you!"),
            },
            {
              text: "App Problem",
              onPress: () => Alert.alert("Reported", "We'll look into this. Thank you!"),
            },
            { text: "Cancel", style: "cancel" },
          ]
        ),
    },
  ];

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          clearSession();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userEmail}>{email}</Text>
          <View style={styles.passengerBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
            <Text style={styles.passengerText}>Passenger</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Menu Items */}
      <ScrollView style={styles.menu}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name={item.icon as any} size={22} color="#1a3cff" />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        ))}

        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={[styles.menuIconBox, { backgroundColor: "#fff0f0" }]}>
            <Ionicons name="log-out-outline" size={22} color="#ff4444" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={styles.footer}>© 2026 NEXBUS SYSTEMS INC. • v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { paddingTop: 54, paddingBottom: 30, paddingHorizontal: 24 },
  closeBtn: { alignSelf: "flex-end", marginBottom: 16 },
  userSection: { alignItems: "center" },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarInitials: { fontSize: 28, fontWeight: "bold", color: "#1a3cff" },
  userName: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  userEmail: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 10 },
  passengerBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20,
  },
  passengerText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  menu: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  menuItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuIconBox: {
    width: 40, height: 40, backgroundColor: "#f0f4ff", borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 15, color: "#1a1a4e", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 10 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  logoutText: { flex: 1, fontSize: 15, color: "#ff4444", fontWeight: "600" },
  footer: { textAlign: "center", fontSize: 11, color: "#aaa", letterSpacing: 0.5, paddingVertical: 16 },
});
