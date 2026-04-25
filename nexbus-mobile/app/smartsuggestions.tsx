import { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, FlatList, SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import MapView from "react-native-maps";

// Same route dataset as newbooking.tsx
const ROUTES = [
  { id: "r01",  number: "01",  from: "Fort",       to: "Kandy",        fare: 300, duration: "3 h 30 m", type: "Ordinary",    km: 116 },
  { id: "r48",  number: "48",  from: "Fort",       to: "Kandy",        fare: 420, duration: "3 h",      type: "Semi-Luxury", km: 116 },
  { id: "r17",  number: "17",  from: "Panadura",   to: "Kandy",        fare: 350, duration: "4 h",      type: "Ordinary",    km: 135 },
  { id: "r05",  number: "05",  from: "Fort",       to: "Kurunegala",   fare: 245, duration: "2 h 30 m", type: "Ordinary",    km: 94  },
  { id: "r100", number: "100", from: "Fort",       to: "Kurunegala",   fare: 340, duration: "2 h 15 m", type: "Semi-Luxury", km: 94  },
  { id: "r400", number: "400", from: "Fort",       to: "Negombo",      fare: 130, duration: "1 h 15 m", type: "Ordinary",    km: 50  },
  { id: "r122", number: "122", from: "Pettah",     to: "Avissawella",  fare: 145, duration: "1 h 30 m", type: "Ordinary",    km: 55  },
  { id: "r138", number: "138", from: "Fort",       to: "Maharagama",   fare: 60,  duration: "45 m",     type: "Ordinary",    km: 18  },
  { id: "r187", number: "187", from: "Fort",       to: "Battaramulla", fare: 45,  duration: "35 m",     type: "Ordinary",    km: 15  },
  { id: "r06",  number: "06",  from: "Fort",       to: "Dehiwala",     fare: 35,  duration: "30 m",     type: "Ordinary",    km: 12  },
  { id: "r14",  number: "14",  from: "Pettah",     to: "Kelaniya",     fare: 30,  duration: "25 m",     type: "Ordinary",    km: 10  },
  { id: "r190", number: "190", from: "Maharagama", to: "Meegoda",      fare: 50,  duration: "25 m",     type: "Ordinary",    km: 16  },
];

const ALL_STOPS = Array.from(
  new Set([...ROUTES.map((r) => r.from), ...ROUTES.map((r) => r.to)])
).sort();

const DEPARTURE_TIMES = [
  "05:30 AM", "06:00 AM", "06:30 AM", "07:00 AM",
  "07:30 AM", "08:00 AM", "09:00 AM", "10:00 AM",
  "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM",
  "07:00 PM", "08:00 PM",
];

function parseTimeToMin(t: string): number {
  const [timePart, period] = t.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  let hours = h;
  if (period === "PM" && h !== 12) hours += 12;
  if (period === "AM" && h === 12) hours = 0;
  return hours * 60 + m;
}

function parseDurationMin(duration: string): number {
  let total = 0;
  const hMatch = duration.match(/(\d+)\s*h/);
  const mMatch = duration.match(/(\d+)\s*m/);
  if (hMatch) total += parseInt(hMatch[1]) * 60;
  if (mMatch) total += parseInt(mMatch[1]);
  return total;
}

function getNextDepartureMin(): number {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const t of DEPARTURE_TIMES) {
    const tMin = parseTimeToMin(t);
    if (tMin > nowMin) return tMin - nowMin;
  }
  return (24 * 60 - nowMin) + parseTimeToMin(DEPARTURE_TIMES[0]);
}

function getSuggestions(from: string, to: string) {
  // Exact corridor match (either direction)
  let matches = ROUTES.filter(
    (r) => (r.from === from && r.to === to) || (r.from === to && r.to === from)
  );
  // Partial: routes serving either stop
  if (matches.length === 0) {
    matches = ROUTES.filter(
      (r) => r.from === from || r.to === to || r.from === to || r.to === from
    );
  }
  // Sort by travel duration ascending (fastest first)
  return matches.sort(
    (a, b) => parseDurationMin(a.duration) - parseDurationMin(b.duration)
  );
}

function getSmartTip(suggestions: typeof ROUTES): string {
  if (suggestions.length === 0) {
    return "No direct service found. Check the Live Map for nearby active buses.";
  }
  if (suggestions.length === 1) {
    return `Bus ${suggestions[0].number} is the only direct service on this route. Book early to secure your seat.`;
  }
  const best = suggestions[0];
  const ordinary = suggestions.find((r) => r.type === "Ordinary");
  if (best.type === "Semi-Luxury" && ordinary) {
    const savings = best.fare - ordinary.fare;
    return `The ordinary option saves LKR ${savings} per seat. Bus ${ordinary.number} covers the same route.`;
  }
  return "Bus 138 is currently the most reliable choice for urban routes.";
}

export default function SmartSuggestionsScreen() {
  const router = useRouter();
  const [fromStop, setFromStop] = useState("Fort");
  const [toStop, setToStop]     = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<"from" | "to" | null>(null);

  const pickupMin = useMemo(() => getNextDepartureMin(), []);

  const suggestions = useMemo(
    () => (toStop ? getSuggestions(fromStop, toStop) : []),
    [fromStop, toStop]
  );

  const best        = suggestions[0] ?? null;
  const alternatives = suggestions.slice(1, 3);
  const smartTip    = useMemo(() => getSmartTip(suggestions), [suggestions]);

  const totalEta = best ? pickupMin + parseDurationMin(best.duration) : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6fa" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a4e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Suggestions</Text>
        <TouchableOpacity>
          <Ionicons name="search-outline" size={24} color="#1a1a4e" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── From / To Selector ── */}
        <View style={styles.selectorCard}>
          {/* FROM */}
          <TouchableOpacity
            style={styles.stopRow}
            onPress={() => setPickerFor("from")}
            activeOpacity={0.7}
          >
            <View style={styles.stopIconWrap}>
              <Ionicons name="bus" size={16} color="#1a3cff" />
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopLabel}>FROM</Text>
              <Text style={styles.stopName}>{fromStop}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#aaa" />
          </TouchableOpacity>

          <View style={styles.selectorDivider}>
            <View style={styles.dividerLine} />
            <TouchableOpacity
              style={styles.swapBtn}
              onPress={() => {
                if (toStop) {
                  const temp = fromStop;
                  setFromStop(toStop);
                  setToStop(temp);
                }
              }}
            >
              <Ionicons name="swap-vertical" size={16} color="#1a3cff" />
            </TouchableOpacity>
            <View style={styles.dividerLine} />
          </View>

          {/* TO */}
          <TouchableOpacity
            style={styles.stopRow}
            onPress={() => setPickerFor("to")}
            activeOpacity={0.7}
          >
            <View style={[styles.stopIconWrap, { backgroundColor: "#fff3e0" }]}>
              <Ionicons name="location" size={16} color="#ff9800" />
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopLabel}>TO</Text>
              <Text style={[styles.stopName, !toStop && { color: "#bbb" }]}>
                {toStop ?? "Select destination"}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#aaa" />
          </TouchableOpacity>
        </View>

        {/* ── Map Preview ── */}
        <View style={styles.mapCard}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: 6.88,
              longitude: 79.88,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          />
          <View style={styles.liveTrafficPill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTrafficText}>Live Traffic Updates</Text>
          </View>
        </View>

        {/* ── Prompt when no destination selected ── */}
        {!toStop && (
          <View style={styles.promptBox}>
            <Ionicons name="bulb-outline" size={32} color="#1a3cff" />
            <Text style={styles.promptTitle}>Select your destination</Text>
            <Text style={styles.promptSub}>
              Choose a "To" stop above to see the best route recommendation
            </Text>
          </View>
        )}

        {/* ── Best Bus Choice ── */}
        {best && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Best Bus Choice</Text>
              <View style={styles.fastestBadge}>
                <Text style={styles.fastestText}>FASTEST</Text>
              </View>
            </View>

            <View style={styles.bestCard}>
              <Text style={styles.recommendedLabel}>RECOMMENDED ROUTE</Text>

              <View style={styles.bestTopRow}>
                <Text style={styles.takeBusText}>Take Bus {best.number}</Text>
                <View style={styles.arrivingPill}>
                  <Text style={styles.arrivingMin}>{pickupMin}</Text>
                  <Text style={styles.arrivingLabel}>{"\n"}min{"\n"}ARRIVING</Text>
                </View>
              </View>

              <View style={styles.bestDivider} />

              {/* Pickup row */}
              <View style={styles.journeyRow}>
                <View style={styles.journeyIconWrap}>
                  <Ionicons name="bus" size={16} color="#1a3cff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.journeyStop}>{best.from}</Text>
                  <Text style={styles.journeyMeta}>Pick up in {pickupMin} mins</Text>
                </View>
              </View>

              <View style={styles.journeyConnector} />

              {/* Destination row */}
              <View style={styles.journeyRow}>
                <View style={[styles.journeyIconWrap, { backgroundColor: "#fff3e0" }]}>
                  <Ionicons name="location" size={16} color="#ff9800" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.journeyStop}>{best.to}</Text>
                  <Text style={styles.journeyMeta}>ETA: {totalEta} mins total</Text>
                </View>
              </View>

              {/* Meta row */}
              <View style={styles.bestMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={12} color="#888" />
                  <Text style={styles.metaChipText}>{best.duration}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="wallet-outline" size={12} color="#888" />
                  <Text style={styles.metaChipText}>LKR {best.fare}/seat</Text>
                </View>
                <View style={[styles.metaChip, best.type === "Semi-Luxury" && styles.luxChip]}>
                  <Text style={[styles.metaChipText, best.type === "Semi-Luxury" && { color: "#f5a623" }]}>
                    {best.type}
                  </Text>
                </View>
              </View>

              {/* Start Journey */}
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => router.push("/newbooking" as any)}
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text style={styles.startBtnText}>Start Journey</Text>
              </TouchableOpacity>
            </View>

            {/* ── Alternative Routes ── */}
            {alternatives.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Alternative Routes</Text>
                {alternatives.map((route) => (
                  <TouchableOpacity
                    key={route.id}
                    style={styles.altCard}
                    onPress={() => router.push("/newbooking" as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.altBadge}>
                      <Text style={styles.altBadgeText}>{route.number}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.altRouteName}>
                        Bus {route.number} • {route.type}
                      </Text>
                      <View style={styles.altMeta}>
                        {route.type === "Semi-Luxury" ? (
                          <>
                            <Ionicons name="star-outline" size={11} color="#f5a623" />
                            <Text style={[styles.altMetaText, { color: "#f5a623" }]}>Semi-Luxury service</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="time-outline" size={11} color="#888" />
                            <Text style={styles.altMetaText}>{route.duration} travel time</Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.altRight}>
                      <Text style={styles.altEta}>{pickupMin + Math.round(parseDurationMin(route.duration) * 0.2)} min</Text>
                      <Ionicons name="chevron-forward" size={16} color="#ccc" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* ── SmartTip ── */}
            <View style={styles.tipCard}>
              <View style={styles.tipIconWrap}>
                <Ionicons name="bulb" size={20} color="#1a3cff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tipTitle}>SmartTip</Text>
                <Text style={styles.tipText}>{smartTip}</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color="#888" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/routes")}>
          <Ionicons name="bus-outline" size={22} color="#888" />
          <Text style={styles.navText}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/map")}>
          <Ionicons name="map-outline" size={22} color="#888" />
          <Text style={styles.navText}>Live Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push("/bookings")}>
          <Ionicons name="ticket-outline" size={22} color="#888" />
          <Text style={styles.navText}>Bookings</Text>
        </TouchableOpacity>
      </View>

      {/* ── Stop Picker Modal ── */}
      <Modal
        visible={pickerFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerFor(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerFor(null)}
        >
          <SafeAreaView style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>
              {pickerFor === "from" ? "Select Departure" : "Select Destination"}
            </Text>
            <FlatList
              data={ALL_STOPS.filter((s) =>
                pickerFor === "from" ? s !== toStop : s !== fromStop
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerRow,
                    ((pickerFor === "from" && item === fromStop) ||
                      (pickerFor === "to" && item === toStop)) &&
                      styles.pickerRowActive,
                  ]}
                  onPress={() => {
                    if (pickerFor === "from") setFromStop(item);
                    else setToStop(item);
                    setPickerFor(null);
                  }}
                >
                  <Ionicons
                    name={pickerFor === "from" ? "bus" : "location"}
                    size={16}
                    color={
                      (pickerFor === "from" && item === fromStop) ||
                      (pickerFor === "to" && item === toStop)
                        ? "#1a3cff"
                        : "#aaa"
                    }
                  />
                  <Text
                    style={[
                      styles.pickerRowText,
                      ((pickerFor === "from" && item === fromStop) ||
                        (pickerFor === "to" && item === toStop)) &&
                        styles.pickerRowTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {((pickerFor === "from" && item === fromStop) ||
                    (pickerFor === "to" && item === toStop)) && (
                    <Ionicons name="checkmark" size={16} color="#1a3cff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f5f6fa" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 14, backgroundColor: "#f5f6fa" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a4e" },
  scroll:      { paddingHorizontal: 20, paddingTop: 8 },

  // Selector card
  selectorCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  stopRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  stopIconWrap:  { width: 34, height: 34, backgroundColor: "#f0f4ff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stopInfo:      { flex: 1 },
  stopLabel:     { fontSize: 10, color: "#aaa", fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  stopName:      { fontSize: 16, fontWeight: "bold", color: "#1a1a4e" },
  selectorDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: "#f0f0f0" },
  swapBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center" },

  // Map
  mapCard:         { borderRadius: 16, overflow: "hidden", height: 160, marginBottom: 20, position: "relative" },
  map:             { flex: 1 },
  liveTrafficPill: { position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4caf50" },
  liveTrafficText: { fontSize: 12, fontWeight: "600", color: "#1a1a4e" },

  // Prompt
  promptBox:   { alignItems: "center", paddingVertical: 32, gap: 10 },
  promptTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e" },
  promptSub:   { fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 20 },

  // Section header
  sectionRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle:  { fontSize: 17, fontWeight: "bold", color: "#1a1a4e", marginBottom: 10 },
  fastestBadge:  { backgroundColor: "#1a3cff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  fastestText:   { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  // Best card
  bestCard:        { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: "#1a3cff20", shadowColor: "#1a3cff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  recommendedLabel:{ fontSize: 10, fontWeight: "700", color: "#1a3cff", letterSpacing: 1, marginBottom: 8 },
  bestTopRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  takeBusText:     { fontSize: 26, fontWeight: "bold", color: "#1a1a4e", flex: 1 },
  arrivingPill:    { backgroundColor: "#f0f4ff", borderRadius: 12, padding: 10, alignItems: "center", minWidth: 60 },
  arrivingMin:     { fontSize: 22, fontWeight: "bold", color: "#1a3cff", lineHeight: 24 },
  arrivingLabel:   { fontSize: 9, color: "#1a3cff", fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  bestDivider:     { height: 1, backgroundColor: "#f0f0f0", marginBottom: 16 },

  journeyRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  journeyIconWrap:  { width: 32, height: 32, backgroundColor: "#f0f4ff", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  journeyStop:      { fontSize: 15, fontWeight: "700", color: "#1a1a4e" },
  journeyMeta:      { fontSize: 12, color: "#888", marginTop: 2 },
  journeyConnector: { width: 2, height: 14, backgroundColor: "#eee", marginLeft: 15, marginBottom: 4 },

  bestMeta:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14, marginBottom: 16 },
  metaChip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f5f6fa", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  metaChipText:{ fontSize: 12, color: "#888", fontWeight: "500" },
  luxChip:     { backgroundColor: "#fff8e1" },

  startBtn:     { backgroundColor: "#1a3cff", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  // Alternative routes
  altCard:      { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#eee", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  altBadge:     { width: 44, height: 44, backgroundColor: "#f0f4ff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  altBadgeText: { fontSize: 15, fontWeight: "bold", color: "#1a3cff" },
  altRouteName: { fontSize: 14, fontWeight: "700", color: "#1a1a4e", marginBottom: 3 },
  altMeta:      { flexDirection: "row", alignItems: "center", gap: 4 },
  altMetaText:  { fontSize: 12, color: "#888" },
  altRight:     { flexDirection: "row", alignItems: "center", gap: 4 },
  altEta:       { fontSize: 14, fontWeight: "700", color: "#1a1a4e" },

  // SmartTip
  tipCard:     { backgroundColor: "#eef2ff", borderRadius: 14, padding: 14, marginTop: 6, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipIconWrap: { width: 36, height: 36, backgroundColor: "#fff", borderRadius: 10, alignItems: "center", justifyContent: "center", shadowColor: "#1a3cff", shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 },
  tipTitle:    { fontSize: 13, fontWeight: "700", color: "#1a3cff", marginBottom: 4 },
  tipText:     { fontSize: 13, color: "#444", lineHeight: 20 },

  // Bottom nav
  bottomNav: { flexDirection: "row", position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee", paddingVertical: 10, paddingBottom: 24 },
  navItem:   { flex: 1, alignItems: "center", gap: 3 },
  navText:   { fontSize: 11, color: "#888" },

  // Picker modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: 20 },
  pickerHandle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  pickerTitle:  { fontSize: 16, fontWeight: "bold", color: "#1a1a4e", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  pickerRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f8f8f8" },
  pickerRowActive: { backgroundColor: "#f0f4ff" },
  pickerRowText:       { flex: 1, fontSize: 16, color: "#1a1a4e" },
  pickerRowTextActive: { fontWeight: "700", color: "#1a3cff" },
});
