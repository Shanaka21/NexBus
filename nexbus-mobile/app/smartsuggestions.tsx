import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, FlatList, SafeAreaView, Switch, ActivityIndicator, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { apiJson, jsonBody } from "../lib/api";
import { currentPosition } from "../lib/position";
import { stopLabel, lkr, clockTime, dayTime, LIVE_STATUS } from "../lib/format";

type Stop = { id: string; name: string; name_si?: string };
type Option = {
  trip_id: string; route_id: string; route_number: string; route_name: string; registration_no: string;
  boarding_stop_id: string; alighting_stop_id: string; eta_min: number; delay_minutes: number;
  reservable_seats: number; available_seats: number; fare_lkr: number; status: string; score: number;
  alight_eta_min: number | null;
};

// One ride on one bus route, as planned by the server from the route and stop data
type Leg = {
  route_id: string; route_number: string; route_name: string; direction: "forward" | "reverse";
  from_stop_id: string; to_stop_id: string; from_name: string; to_name: string;
  via: string[]; stop_count: number; km: number; minutes: number | null; fare_lkr: number;
  departures?: number[];
};
type Plan = { type: "direct" | "change"; legs: Leg[]; score: number };

// Plan Trip: ranked options from live ETA, delay and seat availability, with a plain-language reason
export default function SmartSuggestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string; need_seat?: string }>();

  const [stops, setStops] = useState<Stop[]>([]);
  const [fromId, setFromId] = useState<string | null>(params.from || null);
  const [toId, setToId] = useState<string | null>(params.to || null);
  const [needSeat, setNeedSeat] = useState(params.need_seat === "1");
  const [pickerFor, setPickerFor] = useState<"from" | "to" | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  // Free-text request: the server works out the two stops, then the normal search below shows the buses
  const ask = async () => {
    const query = question.trim();
    if (query.length < 2 || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const position = await currentPosition();
      const { ok, data } = await apiJson("/recommendations/ask", { method: "POST", ...jsonBody({ query, ...(position || {}) }) });
      if (!ok) { setAnswer(data?.error || "The assistant could not answer. Choose the stops below."); return; }
      setAnswer(data.answer);
      if (data.from) setFromId(data.from.id);
      if (data.to) setToId(data.to.id);
      if (data.need_seat) setNeedSeat(true);
    } catch {
      setAnswer("Could not connect to the server.");
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    apiJson("/stops").then(({ ok, data }) => { if (ok && Array.isArray(data)) setStops(data); }).catch(() => {});
  }, []);

  const stopById = (id: string | null) => stops.find((s) => s.id === id);

  const search = useCallback(async () => {
    if (!fromId || !toId) return;
    setLoading(true);
    try {
      const query = `from_stop_id=${fromId}&to_stop_id=${toId}&need_seat=${needSeat}`;
      const [live, journey] = await Promise.all([
        apiJson(`/recommendations?${query}`),
        apiJson(`/recommendations/journey?${query}`).catch(() => null),
      ]);
      const found: Plan[] = journey?.ok && Array.isArray(journey.data?.plans) ? journey.data.plans : [];
      setPlans(found);
      if (live.ok) {
        setOptions(live.data.options);
        setExplanation(live.data.explanation);
        setMessage(live.data.options.length || found.length ? null : "No buses are running between these stops right now.");
      } else {
        setOptions([]);
        setExplanation(null);
        setMessage(found.length ? null : live.status === 404 ? "No bus route connects these stops, even with one change. Try a nearby stop." : live.data?.error || "Could not get suggestions.");
      }
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [fromId, toId, needSeat]);

  useEffect(() => {
    search();
    const timer = setInterval(search, 20000); // ETA changes as the buses move
    return () => clearInterval(timer);
  }, [search]);

  const swap = () => { setFromId(toId); setToId(fromId); };

  const bookLeg = (l: Leg) =>
    router.push({ pathname: "/newbooking", params: { route_id: l.route_id, from: l.from_stop_id, to: l.to_stop_id } } as any);

  const legTime = (l: Leg) => (l.minutes != null ? `~${l.minutes + (l.direction === "reverse" ? 12 : 0)} min` : "");
  const totalFare = (p: Plan) => p.legs.filter((l) => l.direction === "forward").reduce((sum, l) => sum + l.fare_lkr, 0);
  const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

  const book = (o: Option) =>
    router.push({ pathname: "/newbooking", params: { route_id: o.route_id, trip_id: o.trip_id, from: o.boarding_stop_id, to: o.alighting_stop_id } } as any);

  const best = options[0] ?? null;
  const alternatives = options.slice(1);
  const from = stopById(fromId);
  const to = stopById(toId);

  const optionStatus = (o: Option) => {
    const s = LIVE_STATUS[o.status] || LIVE_STATUS.scheduled;
    return (
      <View style={[styles.metaChip, { backgroundColor: s.bg }]}>
        <Text style={[styles.metaChipText, { color: s.color, fontWeight: "700" }]}>
          {s.label}{o.delay_minutes >= 10 ? ` · ${o.delay_minutes} min late` : ""}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6fa" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a4e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Trip</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.askCard}>
          <TextInput
            style={styles.askInput}
            placeholder="Where do you want to go? e.g. Nugegoda yanna ona"
            placeholderTextColor="#aaa"
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={ask}
            returnKeyType="search"
            maxLength={300}
          />
          <TouchableOpacity style={[styles.askBtn, (asking || question.trim().length < 2) && { opacity: 0.5 }]} onPress={ask} disabled={asking || question.trim().length < 2}>
            {asking ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
        {answer && (
          <View style={styles.tipCard}>
            <View style={styles.tipIconWrap}><Ionicons name="sparkles" size={18} color="#1a3cff" /></View>
            <Text style={[styles.tipText, { flex: 1 }]}>{answer}</Text>
          </View>
        )}

        <View style={[styles.selectorCard, { marginTop: 14 }]}>
          <TouchableOpacity style={styles.stopRow} onPress={() => setPickerFor("from")}>
            <View style={styles.stopIconWrap}><Ionicons name="bus" size={18} color="#1a3cff" /></View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopLabel}>FROM</Text>
              <Text style={styles.stopName}>{from ? stopLabel(from) : "Select departure"}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#aaa" />
          </TouchableOpacity>

          <View style={styles.selectorDivider}>
            <View style={styles.dividerLine} />
            <TouchableOpacity style={styles.swapBtn} onPress={swap}>
              <Ionicons name="swap-vertical" size={16} color="#1a3cff" />
            </TouchableOpacity>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.stopRow} onPress={() => setPickerFor("to")}>
            <View style={styles.stopIconWrap}><Ionicons name="location" size={18} color="#1a3cff" /></View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopLabel}>TO</Text>
              <Text style={styles.stopName}>{to ? stopLabel(to) : "Select destination"}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#aaa" />
          </TouchableOpacity>
        </View>

        <View style={styles.seatRow}>
          <Text style={styles.seatText}>I need a seat</Text>
          <Switch value={needSeat} onValueChange={setNeedSeat} trackColor={{ true: "#1a3cff" }} />
        </View>

        {(!fromId || !toId) && (
          <View style={styles.promptBox}>
            <Ionicons name="bulb-outline" size={40} color="#ccc" />
            <Text style={styles.promptTitle}>Where are you going?</Text>
            <Text style={styles.promptSub}>Choose a departure and a destination to see the best bus right now.</Text>
          </View>
        )}

        {loading && !best && plans.length === 0 && <ActivityIndicator color="#1a3cff" style={{ marginVertical: 30 }} />}

        {/* ── Which bus to take ── */}
        {fromId && toId && plans.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{plans[0].type === "direct" ? "Bus to take" : "Buses to take"}</Text>
              {plans[0].type === "change" && <View style={styles.fastestBadge}><Text style={styles.fastestText}>NO DIRECT BUS</Text></View>}
            </View>
            {plans.map((p, i) => {
              const first = p.legs[0];
              const upcoming = first.direction === "forward" ? (first.departures || []) : [];
              return (
                <View key={i} style={styles.planCard}>
                  <View style={styles.planHead}>
                    <View style={[styles.metaChip, { backgroundColor: p.type === "direct" ? "#e8f5e9" : "#fff3e0" }]}>
                      <Text style={[styles.metaChipText, { fontWeight: "700", color: p.type === "direct" ? "#2e7d32" : "#a96400" }]}>
                        {p.type === "direct" ? "DIRECT" : "1 CHANGE"}
                      </Text>
                    </View>
                    <Text style={styles.planSummary}>about {hours(p.score)} · {lkr(totalFare(p))}</Text>
                  </View>

                  {p.legs.map((l, li) => (
                    <View key={l.route_id + li}>
                      {li > 0 && (
                        <View style={styles.changeRow}>
                          <Ionicons name="swap-vertical" size={14} color="#a96400" />
                          <Text style={styles.changeText}>Change buses at {p.legs[li - 1].to_name}</Text>
                        </View>
                      )}
                      <View style={styles.legCard}>
                        <View style={styles.altBadge}><Text style={styles.altBadgeText}>{l.route_number}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.legTitle}>Take bus {l.route_number}</Text>
                          <Text style={styles.legRoute}>{l.from_name} → {l.to_name}</Text>
                          <Text style={styles.legMeta}>
                            {l.stop_count} stop{l.stop_count === 1 ? "" : "s"} · {l.km} km {legTime(l) ? `· ${legTime(l)}` : ""}
                          </Text>
                          {l.via.length > 0 && <Text style={styles.legVia} numberOfLines={2}>via {l.via.join(", ")}</Text>}
                          {l.direction === "reverse" && (
                            <Text style={styles.legNote}>Runs this way too, but there is no timetable or booking for this direction yet.</Text>
                          )}
                        </View>
                        {l.direction === "forward" && (
                          <TouchableOpacity style={styles.legBook} onPress={() => bookLeg(l)}>
                            <Ionicons name="ticket-outline" size={14} color="#1a3cff" />
                            <Text style={styles.legBookText}>Book</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}

                  {upcoming.length > 0 ? (
                    <Text style={styles.planNext}>Next buses from {first.from_name}: {upcoming.map((t) => dayTime(t)).join(" · ")}</Text>
                  ) : first.direction === "forward" ? (
                    <Text style={styles.planNext}>No more departures are scheduled on route {first.route_number} right now.</Text>
                  ) : null}
                </View>
              );
            })}
          </>
        )}

        {message && !loading && fromId && toId && plans.length === 0 && (
          <View style={styles.promptBox}>
            <Ionicons name="bus-outline" size={40} color="#ccc" />
            <Text style={styles.promptSub}>{message}</Text>
          </View>
        )}

        {best && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{plans.length > 0 ? "Live now" : "Best option"}</Text>
              <View style={styles.fastestBadge}><Text style={styles.fastestText}>RECOMMENDED</Text></View>
            </View>

            <View style={styles.bestCard}>
              <View style={styles.bestTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.takeBusText}>Take Bus {best.route_number}</Text>
                  <Text style={styles.journeyMeta}>{best.route_name} · {best.registration_no}</Text>
                </View>
                <View style={styles.arrivingPill}>
                  <Text style={styles.arrivingMin}>{best.eta_min}</Text>
                  <Text style={styles.arrivingLabel}>MIN</Text>
                </View>
              </View>

              <View style={styles.legs}>
                <View style={styles.legRow}>
                  <Ionicons name="log-in-outline" size={16} color="#1a3cff" />
                  <Text style={styles.legText}>Board at {from ? stopLabel(from) : "your stop"}</Text>
                  <Text style={styles.legTime}>{clockTime(Date.now() + best.eta_min * 60000)}</Text>
                </View>
                <View style={styles.legRow}>
                  <Ionicons name="log-out-outline" size={16} color="#1a3cff" />
                  <Text style={styles.legText}>Get off at {to ? stopLabel(to) : "your destination"}</Text>
                  <Text style={styles.legTime}>{best.alight_eta_min != null ? clockTime(Date.now() + best.alight_eta_min * 60000) : ""}</Text>
                </View>
              </View>

              <View style={styles.bestMeta}>
                {optionStatus(best)}
                {best.reservable_seats > 0 && (
                  <View style={styles.metaChip}>
                    <Ionicons name="people-outline" size={12} color="#888" />
                    <Text style={styles.metaChipText}>{best.available_seats} seats free</Text>
                  </View>
                )}
                <View style={styles.metaChip}>
                  <Ionicons name="cash-outline" size={12} color="#888" />
                  <Text style={styles.metaChipText}>{lkr(best.fare_lkr)}</Text>
                </View>
              </View>

              {best.reservable_seats > 0 ? (
                <TouchableOpacity style={styles.startBtn} onPress={() => book(best)}>
                  <Ionicons name="ticket-outline" size={18} color="#fff" />
                  <Text style={styles.startBtnText}>Book seats</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.startBtn} onPress={() => router.push("/map")}>
                  <Ionicons name="navigate" size={18} color="#fff" />
                  <Text style={styles.startBtnText}>Track this bus</Text>
                </TouchableOpacity>
              )}
            </View>

            {alternatives.length > 0 && <Text style={styles.sectionTitle}>Other options</Text>}
            {alternatives.map((o) => (
              <TouchableOpacity key={o.trip_id} style={styles.altCard} onPress={() => (o.reservable_seats > 0 ? book(o) : router.push("/map"))}>
                <View style={styles.altBadge}><Text style={styles.altBadgeText}>{o.route_number}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.altRouteName}>{o.route_name}</Text>
                  <View style={styles.altMeta}>
                    <Text style={styles.altMetaText}>{o.registration_no}</Text>
                    <Text style={styles.altMetaText}>·</Text>
                    <Text style={styles.altMetaText}>
                      {o.delay_minutes >= 10 ? `${o.delay_minutes} min late` : (LIVE_STATUS[o.status] || LIVE_STATUS.scheduled).label.toLowerCase()}
                    </Text>
                    {o.reservable_seats > 0 && <Text style={styles.altMetaText}>· {o.available_seats} seats</Text>}
                  </View>
                </View>
                <View style={styles.altRight}>
                  <Text style={styles.altEta}>{o.eta_min} min</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </View>
              </TouchableOpacity>
            ))}

            {explanation && (
              <View style={styles.tipCard}>
                <View style={styles.tipIconWrap}><Ionicons name="bulb" size={20} color="#1a3cff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>Why this bus?</Text>
                  <Text style={styles.tipText}>{explanation}</Text>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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

      <Modal visible={pickerFor !== null} animationType="slide" transparent onRequestClose={() => setPickerFor(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerFor(null)}>
          <SafeAreaView style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>{pickerFor === "from" ? "Select Departure" : "Select Destination"}</Text>
            <FlatList
              data={stops.filter((s) => (pickerFor === "from" ? s.id !== toId : s.id !== fromId))}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const active = (pickerFor === "from" && item.id === fromId) || (pickerFor === "to" && item.id === toId);
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => { if (pickerFor === "from") setFromId(item.id); else setToId(item.id); setPickerFor(null); }}
                  >
                    <Ionicons name={pickerFor === "from" ? "bus" : "location"} size={16} color={active ? "#1a3cff" : "#aaa"} />
                    <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>{stopLabel(item)}</Text>
                    {active && <Ionicons name="checkmark" size={16} color="#1a3cff" />}
                  </TouchableOpacity>
                );
              }}
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

  selectorCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  stopRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  stopIconWrap:  { width: 34, height: 34, backgroundColor: "#f0f4ff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stopInfo:      { flex: 1 },
  stopLabel:     { fontSize: 10, color: "#aaa", fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  stopName:      { fontSize: 16, fontWeight: "bold", color: "#1a1a4e" },
  selectorDivider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: "#f0f0f0" },
  swapBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f0f4ff", alignItems: "center", justifyContent: "center" },

  askCard:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, padding: 10, paddingLeft: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  askInput: { flex: 1, fontSize: 15, color: "#1a1a4e", paddingVertical: 8 },
  askBtn:   { width: 42, height: 42, borderRadius: 12, backgroundColor: "#1a3cff", alignItems: "center", justifyContent: "center" },

  legs:    { marginTop: 12, gap: 8, backgroundColor: "#f5f6fa", borderRadius: 12, padding: 12 },
  legRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  legText: { flex: 1, fontSize: 13, color: "#1a1a4e", fontWeight: "600" },
  legTime: { fontSize: 13, color: "#1a3cff", fontWeight: "700" },

  seatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 18 },
  seatText: { fontSize: 15, fontWeight: "600", color: "#1a1a4e" },

  promptBox:   { alignItems: "center", paddingVertical: 32, gap: 10 },
  promptTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e" },
  promptSub:   { fontSize: 13, color: "#aaa", textAlign: "center", lineHeight: 20 },

  sectionRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle:  { fontSize: 17, fontWeight: "bold", color: "#1a1a4e", marginBottom: 10 },
  fastestBadge:  { backgroundColor: "#1a3cff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  fastestText:   { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 1 },

  bestCard:        { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1.5, borderColor: "#1a3cff20", shadowColor: "#1a3cff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  bestTopRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  takeBusText:     { fontSize: 24, fontWeight: "bold", color: "#1a1a4e" },
  arrivingPill:    { backgroundColor: "#f0f4ff", borderRadius: 12, padding: 10, alignItems: "center", minWidth: 60 },
  arrivingMin:     { fontSize: 22, fontWeight: "bold", color: "#1a3cff", lineHeight: 24 },
  arrivingLabel:   { fontSize: 9, color: "#1a3cff", fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  journeyMeta:     { fontSize: 12, color: "#888", marginTop: 2 },

  bestMeta:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 16 },
  metaChip:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f5f6fa", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  metaChipText:{ fontSize: 12, color: "#888", fontWeight: "500" },

  startBtn:     { backgroundColor: "#1a3cff", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },

  altCard:      { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#eee" },
  altBadge:     { width: 44, height: 44, backgroundColor: "#f0f4ff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  altBadgeText: { fontSize: 15, fontWeight: "bold", color: "#1a3cff" },
  altRouteName: { fontSize: 14, fontWeight: "700", color: "#1a1a4e", marginBottom: 3 },
  altMeta:      { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  altMetaText:  { fontSize: 12, color: "#888" },
  altRight:     { flexDirection: "row", alignItems: "center", gap: 4 },
  altEta:       { fontSize: 14, fontWeight: "700", color: "#1a1a4e" },

  tipCard:     { backgroundColor: "#eef2ff", borderRadius: 14, padding: 14, marginTop: 6, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tipIconWrap: { width: 36, height: 36, backgroundColor: "#fff", borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipTitle:    { fontSize: 13, fontWeight: "700", color: "#1a3cff", marginBottom: 4 },
  tipText:     { fontSize: 13, color: "#444", lineHeight: 20 },

  bottomNav: { flexDirection: "row", position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee", paddingVertical: 10, paddingBottom: 24 },
  navItem:   { flex: 1, alignItems: "center", gap: 3 },
  navText:   { fontSize: 11, color: "#888" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet:  { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%", paddingBottom: 20 },
  pickerHandle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  pickerTitle:  { fontSize: 16, fontWeight: "bold", color: "#1a1a4e", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  pickerRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f8f8f8" },
  pickerRowActive: { backgroundColor: "#f0f4ff" },
  pickerRowText:       { flex: 1, fontSize: 16, color: "#1a1a4e" },
  pickerRowTextActive: { fontWeight: "700", color: "#1a3cff" },

  planCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  planHead:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  planSummary: { fontSize: 13, color: "#666", fontWeight: "600" },
  planNext:    { fontSize: 12.5, color: "#1a3cff", fontWeight: "600", marginTop: 10, lineHeight: 18 },
  legCard:     { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#f7f8fd", borderRadius: 12, padding: 12 },
  legTitle:    { fontSize: 15, fontWeight: "700", color: "#1a1a4e" },
  legRoute:    { fontSize: 13.5, color: "#333", marginTop: 2, fontWeight: "600" },
  legMeta:     { fontSize: 12, color: "#888", marginTop: 3 },
  legVia:      { fontSize: 12, color: "#999", marginTop: 2 },
  legNote:     { fontSize: 11.5, color: "#a96400", marginTop: 4 },
  legBook:     { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#c8d6ff", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  legBookText: { fontSize: 12.5, fontWeight: "700", color: "#1a3cff" },
  changeRow:   { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingLeft: 6 },
  changeText:  { fontSize: 12.5, color: "#a96400", fontWeight: "600" },
});
