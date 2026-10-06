import { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, StatusBar,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../lib/api";
import { currentPosition } from "../lib/position";
import { useTheme } from "../lib/themeContext";

type Leg = { from_stop_id: string; to_stop_id: string };
type TripOption = { trip_id: string; route_id: string; boarding_stop_id: string; alighting_stop_id: string; reservable_seats: number };
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  error?: boolean;
  trip?: { from: string; to: string; needSeat: boolean; option: TripOption | null; firstLeg: Leg | null };
};

const WELCOME: Message = {
  id: 0,
  role: "assistant",
  text: "Hi! I'm the NexBus Assistant. Ask me anything. Tell me where you want to go and I'll find the bus, where to board and get off, and when.",
};

const SUGGESTIONS = ["Mata Nugegoda yanna ona", "Which bus goes to Kandy?", "How do I book a seat?", "ඔයාට කොහොමද?"];

const light = { bg: "#f5f6fa", bot: "#fff", botText: "#1a1a4e", inputBar: "#fff", input: "#f0f0f5", inputText: "#1a1a4e", chip: "#fff", chipBorder: "#d0d8ff" };
const dark = { bg: "#0d0d1a", bot: "#1a1a2e", botText: "#dde0ff", inputBar: "#1a1a2e", input: "#252548", inputText: "#dde0ff", chip: "#1a1a2e", chipBorder: "#2a3480" };

export default function AssistantScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);
  const nextId = useRef(1);

  const scrollDown = useCallback(() => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50), []);

  const send = async (raw?: string) => {
    const query = (raw ?? input).trim();
    if (!query || sending) return;
    const history = messages
      .filter((m) => m.id !== 0 && !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 600) }));

    setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text: query }]);
    setInput("");
    setSending(true);
    scrollDown();

    let reply: Message;
    try {
      const position = await currentPosition();
      const { ok, data } = await apiJson("/recommendations/ask", { method: "POST", ...jsonBody({ query, history, ...(position || {}) }) });
      if (!ok) {
        reply = { id: nextId.current++, role: "assistant", error: true, text: data?.error || "Sorry, something went wrong. Please try again." };
      } else {
        reply = {
          id: nextId.current++,
          role: "assistant",
          text: data.answer,
          trip: data.type === "trip" && data.from && data.to
            ? { from: data.from.id, to: data.to.id, needSeat: !!data.need_seat, option: data.options?.[0] ?? null, firstLeg: data.legs?.[0] ?? null }
            : undefined,
        };
      }
    } catch {
      reply = { id: nextId.current++, role: "assistant", error: true, text: "Could not connect to the server." };
    }
    setMessages((prev) => [...prev, reply]);
    setSending(false);
    scrollDown();
  };

  // With a change of bus, the first ride is the one that can be looked at and booked now
  const seeBuses = (t: NonNullable<Message["trip"]>) =>
    router.push({
      pathname: "/smartsuggestions",
      params: { from: t.firstLeg?.from_stop_id ?? t.from, to: t.firstLeg?.to_stop_id ?? t.to, need_seat: t.needSeat ? "1" : "0" },
    } as any);

  const bookSeats = (t: NonNullable<Message["trip"]>) =>
    t.option && router.push({
      pathname: "/newbooking",
      params: { route_id: t.option.route_id, trip_id: t.option.trip_id, from: t.option.boarding_stop_id, to: t.option.alighting_stop_id },
    } as any);

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="sparkles" size={18} color="#fff" />
          <Text style={styles.headerTitle}>NexBus Assistant</Text>
        </View>
        <TouchableOpacity onPress={() => { setMessages([WELCOME]); setInput(""); }}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.messages}
          onContentSizeChange={scrollDown}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubble, styles.botBubble, { backgroundColor: p.bot }]}>
                <ActivityIndicator size="small" color="#1a3cff" />
              </View>
            ) : null
          }
          renderItem={({ item: m }) => {
            const mine = m.role === "user";
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                <View style={[styles.bubble, mine ? styles.userBubble : [styles.botBubble, { backgroundColor: p.bot }], m.error && styles.errorBubble]}>
                  <Text style={[styles.bubbleText, { color: mine ? "#fff" : p.botText }, m.error && { color: "#c62828" }]} selectable>
                    {m.text}
                  </Text>
                  {m.trip && (
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => seeBuses(m.trip!)}>
                        <Ionicons name="bus-outline" size={14} color="#1a3cff" />
                        <Text style={styles.actionText}>See buses</Text>
                      </TouchableOpacity>
                      {m.trip.option && m.trip.option.reservable_seats > 0 && (
                        <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => bookSeats(m.trip!)}>
                          <Ionicons name="ticket-outline" size={14} color="#fff" />
                          <Text style={[styles.actionText, { color: "#fff" }]}>Book seats</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />

        {messages.length === 1 && (
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: p.chip, borderColor: p.chipBorder }]} onPress={() => send(s)}>
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: p.inputBar }]}>
          <TextInput
            style={[styles.input, { backgroundColor: p.input, color: p.inputText }]}
            placeholder="Ask me anything…"
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            maxLength={300}
            multiline={false}
          />
          <TouchableOpacity style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]} onPress={() => send()} disabled={!input.trim() || sending}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 18 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },

  messages: { padding: 16, paddingBottom: 8, gap: 10 },
  row: { flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  botBubble: { borderTopLeftRadius: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  userBubble: { backgroundColor: "#1a3cff", borderTopRightRadius: 4 },
  errorBubble: { backgroundColor: "#ffebee" },
  bubbleText: { fontSize: 15, lineHeight: 21 },

  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f0f4ff", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  actionPrimary: { backgroundColor: "#1a3cff" },
  actionText: { fontSize: 12, fontWeight: "700", color: "#1a3cff" },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, color: "#1a3cff", fontWeight: "600" },

  inputBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 22 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1a3cff", alignItems: "center", justifyContent: "center" },
});
