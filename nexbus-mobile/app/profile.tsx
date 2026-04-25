import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, TextInput, Alert, ActivityIndicator, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserId, getUserName, getUserEmail, setUserName } from "./userSession";
import { API_URL } from "./config";
import { useTheme } from "./themeContext";

const AVATAR_KEY = "nexbus_avatar_uri";

const light = {
  bg:         "#f0f0f5",
  card:       "#fff",
  text:       "#1a1a4e",
  subText:    "#888",
  iconBox:    "#f0f4ff",
  roleBadge:  "#f0f4ff",
  divider:    "#f5f5f5",
  cancelBtn:  "#fff",
  cancelBorder:"#d0d8ff",
  secondaryBtn:"#fff",
};

const dark = {
  bg:         "#0d0d1a",
  card:       "#1a1a2e",
  text:       "#dde0ff",
  subText:    "#888",
  iconBox:    "#1e2250",
  roleBadge:  "#1e2250",
  divider:    "#2a2a4e",
  cancelBtn:  "#1a1a2e",
  cancelBorder:"#2a3480",
  secondaryBtn:"#1a1a2e",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const uid   = getUserId();
  const email = getUserEmail() || "—";
  const [displayName, setDisplayName] = useState(getUserName() || "Guest User");
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "U";

  const [avatarUri, setAvatarUri]   = useState<string | null>(null);
  const [stats, setStats]           = useState({ total: 0, confirmed: 0, completed: 0, cancelled: 0 });
  const [profile, setProfile]       = useState({ phone: "", region: "Sri Lanka", role: "passenger" });
  const [editing, setEditing]       = useState(false);
  const [editName, setEditName]     = useState(displayName);
  const [editPhone, setEditPhone]   = useState("");
  const [editRegion, setEditRegion] = useState("Sri Lanka");
  const [saving, setSaving]         = useState(false);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(AVATAR_KEY).then((uri) => { if (uri) setAvatarUri(uri); });
    }, [])
  );

  useEffect(() => {
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

    fetch(`${API_URL}/auth/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.uid) {
          const pr = { phone: data.phone || "", region: data.region || "Sri Lanka", role: data.role || "passenger" };
          setProfile(pr);
          setEditPhone(pr.phone);
          setEditRegion(pr.region);
        }
      })
      .catch(() => {});
  }, []);

  const roleLabel = profile.role === "operator" ? "Bus Operator" : "Passenger";

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Allow photo access to set a profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await AsyncStorage.setItem(AVATAR_KEY, uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Required", "Allow camera access to take a profile photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await AsyncStorage.setItem(AVATAR_KEY, uri);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert("Profile Photo", "Choose an option", [
      { text: "Take Photo",          onPress: takePhoto },
      { text: "Choose from Library", onPress: pickAvatar },
      ...(avatarUri ? [{ text: "Remove Photo", style: "destructive" as const, onPress: async () => { setAvatarUri(null); await AsyncStorage.removeItem(AVATAR_KEY); } }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/${uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone, region: editRegion }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => ({ ...prev, phone: editPhone, region: editRegion }));
        setDisplayName(editName);
        setUserName(editName);
        setEditing(false);
        Alert.alert("Saved", "Your profile has been updated.");
      } else {
        Alert.alert("Error", data.error || "Failed to save. Try again.");
      }
    } catch {
      Alert.alert("Error", "Network error. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(displayName);
    setEditPhone(profile.phone);
    setEditRegion(profile.region);
    setEditing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={() => setEditing(!editing)}>
          <Ionicons name={editing ? "close-outline" : "pencil-outline"} size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Avatar Card */}
        <View style={[styles.avatarCard, { backgroundColor: p.card }]}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={showAvatarOptions} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: p.iconBox }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.name, { color: p.text }]}>{displayName}</Text>
          <Text style={styles.emailText}>{email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: p.roleBadge }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#1a3cff" />
            <Text style={styles.roleText}>Verified {roleLabel}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: p.card }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: p.text }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#4caf50" }]}>{stats.confirmed}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#1a3cff" }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: p.divider }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: "#f44336" }]}>{stats.cancelled}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Account Details */}
        <View style={[styles.section, { backgroundColor: p.card }]}>
          <Text style={[styles.sectionTitle, { color: p.text }]}>Account Details</Text>

          <DetailRow icon="mail-outline"  label="Email Address" value={email}     palette={p} />
          <DetailRow icon="bus-outline"   label="Account Type"  value={roleLabel} palette={p} />

          <View style={[styles.detailRow, { borderBottomColor: p.divider }]}>
            <View style={[styles.detailIcon, { backgroundColor: p.iconBox }]}>
              <Ionicons name="person-outline" size={18} color="#1a3cff" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Full Name</Text>
              {editing ? (
                <TextInput style={[styles.detailInput, { color: p.text }]} value={editName} onChangeText={setEditName} placeholder="Enter full name" placeholderTextColor="#aaa" />
              ) : (
                <Text style={[styles.detailValue, { color: p.text }]}>{displayName}</Text>
              )}
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: p.divider }]}>
            <View style={[styles.detailIcon, { backgroundColor: p.iconBox }]}>
              <Ionicons name="call-outline" size={18} color="#1a3cff" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone Number</Text>
              {editing ? (
                <TextInput style={[styles.detailInput, { color: p.text }]} value={editPhone} onChangeText={setEditPhone} placeholder="+94 7X XXX XXXX" placeholderTextColor="#aaa" keyboardType="phone-pad" />
              ) : (
                <Text style={[styles.detailValue, { color: p.text }]}>{profile.phone || "—"}</Text>
              )}
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.detailIcon, { backgroundColor: p.iconBox }]}>
              <Ionicons name="location-outline" size={18} color="#1a3cff" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Region</Text>
              {editing ? (
                <TextInput style={[styles.detailInput, { color: p.text }]} value={editRegion} onChangeText={setEditRegion} placeholder="e.g. Colombo" placeholderTextColor="#aaa" />
              ) : (
                <Text style={[styles.detailValue, { color: p.text }]}>{profile.region || "—"}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Save / Cancel */}
        {editing && (
          <View style={styles.editActions}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: p.cancelBtn, borderColor: p.cancelBorder }]} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.saveBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {!editing && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/newbooking" as any)}>
              <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.primaryBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="ticket-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Book a Ride</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: p.secondaryBtn, borderColor: p.cancelBorder }]} onPress={() => router.push("/bookings")}>
              <Ionicons name="time-outline" size={18} color="#1a3cff" />
              <Text style={styles.secondaryBtnText}>View Trip History</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, palette }: { icon: string; label: string; value: string; palette: typeof light }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: palette.divider }]}>
      <View style={[styles.detailIcon, { backgroundColor: palette.iconBox }]}>
        <Ionicons name={icon as any} size={18} color="#1a3cff" />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll:      { padding: 20, paddingBottom: 40 },

  avatarCard:     { borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  avatarWrapper:  { position: "relative", marginBottom: 14 },
  avatarImage:    { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: "#1a3cff" },
  avatarCircle:   { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#1a3cff" },
  avatarInitials: { fontSize: 32, fontWeight: "bold", color: "#1a3cff" },
  cameraBadge:    { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: "#1a3cff", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  name:           { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  emailText:      { fontSize: 14, color: "#888", marginBottom: 10 },
  roleBadge:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText:       { fontSize: 12, color: "#1a3cff", fontWeight: "600" },

  statsCard:   { flexDirection: "row", borderRadius: 16, paddingVertical: 18, paddingHorizontal: 10, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  statBox:     { flex: 1, alignItems: "center" },
  statDivider: { width: 1 },
  statNum:     { fontSize: 22, fontWeight: "bold" },
  statLabel:   { fontSize: 11, color: "#888", marginTop: 2 },

  section:      { borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 14, letterSpacing: 0.3 },
  detailRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  detailIcon:   { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 14 },
  detailContent:{ flex: 1 },
  detailLabel:  { fontSize: 12, color: "#aaa", marginBottom: 2 },
  detailValue:  { fontSize: 15, fontWeight: "500" },
  detailInput:  { fontSize: 15, fontWeight: "500", borderBottomWidth: 1.5, borderBottomColor: "#1a3cff", paddingBottom: 2, paddingTop: 2 },

  editActions:     { flexDirection: "row", gap: 12, marginBottom: 16 },
  cancelBtn:       { flex: 1, borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1 },
  cancelBtnText:   { color: "#1a3cff", fontSize: 15, fontWeight: "600" },
  saveBtn:         { flex: 2, borderRadius: 14 },
  saveBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14 },
  saveBtnText:     { color: "#fff", fontSize: 15, fontWeight: "bold" },

  primaryBtn:        { borderRadius: 14, marginBottom: 10 },
  primaryBtnGradient:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 10 },
  primaryBtnText:    { color: "#fff", fontSize: 16, fontWeight: "bold" },
  secondaryBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 10, borderWidth: 1 },
  secondaryBtnText:  { color: "#1a3cff", fontSize: 16, fontWeight: "600" },
});
