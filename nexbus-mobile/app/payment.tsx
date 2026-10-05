import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../lib/api";
import { startPayHere } from "../lib/payhere";

type Booking = {
  id: string; booking_reference: string; route_number: string; from: string; to: string; date: string; time: string;
  seats: number; seat_numbers?: number[]; fare: string; booking_status: string; payment_status: string; hold_expires_at: number | null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson(`/bookings/${id}`);
    if (mounted.current && ok) setBooking(data);
    if (mounted.current) setLoading(false);
    return ok ? (data as Booking) : null;
  }, [id]);

  useEffect(() => {
    mounted.current = true;
    load().catch(() => setLoading(false));
    return () => { mounted.current = false; };
  }, [load]);

  // Countdown of the 10 minute seat hold
  useEffect(() => {
    if (!booking?.hold_expires_at || booking.booking_status !== "pending_payment") return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((booking.hold_expires_at! - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [booking]);

  // The booking is confirmed by the server when PayHere's notification arrives. The app only waits for it.
  const waitForConfirmation = async () => {
    for (let i = 0; i < 12; i++) {
      const fresh = await load();
      if (fresh && fresh.booking_status === "confirmed") return true;
      await wait(1500);
    }
    return false;
  };

  const handlePay = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      const checkout = await apiJson("/payments/checkout", { method: "POST", ...jsonBody({ booking_id: booking.id }) });
      if (!checkout.ok) {
        Alert.alert("Cannot pay", checkout.data?.error || "Please try again.");
        await load();
        return;
      }

      let result = await startPayHere(checkout.data);
      if (result === "unavailable") {
        // Expo Go and the web cannot open the PayHere SDK: use the sandbox simulator when the server allows it
        const sim = await apiJson("/payments/simulate", { method: "POST", ...jsonBody({ order_id: checkout.data.order_id }) });
        if (!sim.ok) {
          Alert.alert(
            "PayHere not available here",
            "The PayHere checkout needs a development build of the app. Install it to pay, or ask the administrator to enable the sandbox simulator."
          );
          return;
        }
        result = "completed";
      }

      if (result === "dismissed") { Alert.alert("Payment cancelled", "You can try again before the seat hold expires."); return; }
      if (result === "error") { Alert.alert("Payment failed", "The payment could not be completed. You can try again."); return; }

      const confirmed = await waitForConfirmation();
      if (!confirmed) Alert.alert("Processing", "We are waiting for the payment confirmation. Check My Bookings in a moment.");
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel booking", "Release the held seats?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel", style: "destructive",
        onPress: async () => {
          const { ok, data } = await apiJson(`/bookings/${booking.id}/cancel`, { method: "PATCH" });
          if (ok) router.replace("/bookings");
          else Alert.alert("Error", data?.error || "Could not cancel.");
        },
      },
    ]);
  };

  const confirmed = booking?.booking_status === "confirmed";
  const expired = booking && ["expired", "cancelled"].includes(booking.booking_status);
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/bookings")}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{confirmed ? "Booking Confirmed" : "Payment"}</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {loading || !booking ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {confirmed ? (
            <View style={styles.statusBox}>
              <Ionicons name="checkmark-circle" size={64} color="#4caf50" />
              <Text style={styles.statusTitle}>You are all set!</Text>
              <Text style={styles.statusSub}>Payment received. Show this reference to the conductor.</Text>
              <Text style={styles.reference}>{booking.booking_reference}</Text>
            </View>
          ) : expired ? (
            <View style={styles.statusBox}>
              <Ionicons name="time-outline" size={64} color="#f44336" />
              <Text style={styles.statusTitle}>Booking {booking.booking_status}</Text>
              <Text style={styles.statusSub}>The seats were released. You can book again.</Text>
            </View>
          ) : (
            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>SEATS HELD FOR</Text>
              <Text style={[styles.timer, secondsLeft < 60 && { color: "#f44336" }]}>{minutes}:{seconds}</Text>
            </View>
          )}

          <View style={styles.card}>
            <Row label="Reference" value={booking.booking_reference} />
            <Row label="Route" value={`${booking.route_number} · ${booking.from} → ${booking.to}`} />
            <Row label="Departure" value={`${booking.date} ${booking.time}`} />
            <Row label="Seats" value={booking.seat_numbers?.length ? booking.seat_numbers.join(', ') : String(booking.seats)} />
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.total}>Total</Text>
              <Text style={styles.total}>{booking.fare}</Text>
            </View>
          </View>

          {booking.booking_status === "pending_payment" && (
            <>
              <TouchableOpacity onPress={handlePay} disabled={busy || secondsLeft === 0}>
                <LinearGradient
                  colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
                  style={[styles.payButton, (busy || secondsLeft === 0) && { opacity: 0.5 }]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="card-outline" size={20} color="#fff" />}
                  <Text style={styles.payText}>{busy ? "Processing…" : "Pay now with PayHere"}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.note}>You pay on PayHere's secure page. NexBus never sees your card details.</Text>
              <TouchableOpacity onPress={handleCancel} style={styles.cancelLink}>
                <Text style={styles.cancelText}>Cancel this booking</Text>
              </TouchableOpacity>
            </>
          )}

          {(confirmed || expired) && (
            <TouchableOpacity style={styles.doneButton} onPress={() => router.replace("/bookings")}>
              <Text style={styles.doneText}>View My Bookings</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20 },
  timerBox: { alignItems: "center", marginBottom: 20 },
  timerLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: "#888" },
  timer: { fontSize: 44, fontWeight: "bold", color: "#1a3cff", marginTop: 4 },
  statusBox: { alignItems: "center", marginBottom: 20, gap: 6 },
  statusTitle: { fontSize: 20, fontWeight: "bold", color: "#1a1a4e" },
  statusSub: { fontSize: 13, color: "#888", textAlign: "center" },
  reference: { fontSize: 26, fontWeight: "bold", letterSpacing: 2, color: "#1a3cff", marginTop: 6 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 14, color: "#888" },
  value: { fontSize: 14, fontWeight: "600", color: "#1a1a4e", flex: 1, textAlign: "right", marginLeft: 8 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  total: { fontSize: 17, fontWeight: "bold", color: "#1a3cff" },
  payButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 10 },
  payText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  note: { fontSize: 12, color: "#888", textAlign: "center", marginTop: 10 },
  cancelLink: { alignItems: "center", marginTop: 16 },
  cancelText: { color: "#f44336", fontWeight: "600" },
  doneButton: { backgroundColor: "#1a3cff", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
