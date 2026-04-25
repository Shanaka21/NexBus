import { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Switch, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { clearSession } from "./userSession";
import { useTheme } from "./themeContext";

const light = {
  bg:       "#f0f0f5",
  section:  "#fff",
  text:     "#1a1a4e",
  iconBox:  "#f0f4ff",
  divider:  "#f5f5f5",
  groupLabel:"#aaa",
};

const dark = {
  bg:       "#0d0d1a",
  section:  "#1a1a2e",
  text:     "#dde0ff",
  iconBox:  "#1e2250",
  divider:  "#2a2a4e",
  groupLabel:"#666",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const p = isDark ? dark : light;

  const [notifBookings, setNotifBookings] = useState(true);
  const [notifArrival,  setNotifArrival]  = useState(true);
  const [notifPromo,    setNotifPromo]    = useState(false);
  const [locationShare, setLocationShare] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all booking history. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { clearSession(); router.replace("/login"); } },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert("Cache Cleared", "App cache has been cleared successfully.");
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Notifications */}
        <Text style={[styles.groupLabel, { color: p.groupLabel }]}>NOTIFICATIONS</Text>
        <View style={[styles.section, { backgroundColor: p.section }]}>
          <ToggleRow icon="ticket-outline"   label="Booking Updates"  sub="Confirmations and cancellations" value={notifBookings} onToggle={setNotifBookings} palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <ToggleRow icon="bus-outline"      label="Bus Arrival Alerts" sub="When your bus is nearby"       value={notifArrival}  onToggle={setNotifArrival}  palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <ToggleRow icon="pricetag-outline" label="Promotions"        sub="Offers and discounts"           value={notifPromo}    onToggle={setNotifPromo}    palette={p} />
        </View>

        {/* Privacy */}
        <Text style={[styles.groupLabel, { color: p.groupLabel }]}>PRIVACY</Text>
        <View style={[styles.section, { backgroundColor: p.section }]}>
          <ToggleRow icon="location-outline" label="Share Location" sub="Used to find nearest stops" value={locationShare} onToggle={setLocationShare} palette={p} />
        </View>

        {/* App */}
        <Text style={[styles.groupLabel, { color: p.groupLabel }]}>APP</Text>
        <View style={[styles.section, { backgroundColor: p.section }]}>
          <ToggleRow icon="moon-outline" label="Dark Mode" sub="Switch app appearance" value={isDark} onToggle={toggleTheme} palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <LinkRow icon="globe-outline"          label="Language"         value="English"          onPress={() => Alert.alert("Language", "Only English is supported currently.")} palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <LinkRow icon="trash-outline"          label="Clear Cache"                               onPress={handleClearCache}                                                      palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <LinkRow icon="document-text-outline"  label="Terms of Service"                          onPress={() => Alert.alert("Terms of Service", "By using NexBus you agree to our terms of service.")} palette={p} />
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <LinkRow icon="shield-outline"         label="Privacy Policy"                            onPress={() => Alert.alert("Privacy Policy", "We do not share your data with third parties.")}       palette={p} />
        </View>

        {/* About */}
        <Text style={[styles.groupLabel, { color: p.groupLabel }]}>ABOUT</Text>
        <View style={[styles.section, { backgroundColor: p.section }]}>
          <View style={styles.infoRow}>
            <View style={[styles.rowIcon, { backgroundColor: p.iconBox }]}>
              <Ionicons name="information-circle-outline" size={20} color="#1a3cff" />
            </View>
            <Text style={[styles.rowLabel, { color: p.text }]}>App Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: p.divider }]} />
          <View style={styles.infoRow}>
            <View style={[styles.rowIcon, { backgroundColor: p.iconBox }]}>
              <Ionicons name="bus-outline" size={20} color="#1a3cff" />
            </View>
            <Text style={[styles.rowLabel, { color: p.text }]}>Platform</Text>
            <Text style={styles.rowValue}>NexBus Sri Lanka</Text>
          </View>
        </View>

        {/* Danger Zone */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="warning-outline" size={18} color="#f44336" />
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function ToggleRow({ icon, label, sub, value, onToggle, palette }: {
  icon: string; label: string; sub?: string;
  value: boolean; onToggle: (v: boolean) => void;
  palette: typeof light;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: palette.iconBox }]}>
        <Ionicons name={icon as any} size={20} color="#1a3cff" />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch value={value} onValueChange={onToggle} trackColor={{ false: "#ddd", true: "#1a3cff" }} thumbColor="#fff" />
    </View>
  );
}

function LinkRow({ icon, label, value, onPress, palette }: {
  icon: string; label: string; value?: string; onPress: () => void;
  palette: typeof light;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: palette.iconBox }]}>
        <Ionicons name={icon as any} size={20} color="#1a3cff" />
      </View>
      <Text style={[styles.rowLabel, { color: palette.text, flex: 1 }]}>{label}</Text>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color="#ccc" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll:      { padding: 20, paddingBottom: 40 },

  groupLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginTop: 8, marginLeft: 4 },
  section:    { borderRadius: 16, marginBottom: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },

  row:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 14 },

  rowDivider: { height: 1, marginLeft: 66 },
  rowIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText:    { flex: 1 },
  rowLabel:   { fontSize: 15, fontWeight: "500" },
  rowSub:     { fontSize: 12, color: "#aaa", marginTop: 2 },
  rowValue:   { fontSize: 14, color: "#888" },

  deleteBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#ffebee", borderRadius: 14, paddingVertical: 16, gap: 10, borderWidth: 1, borderColor: "#ffcdd2" },
  deleteBtnText: { color: "#f44336", fontSize: 15, fontWeight: "600" },
});
