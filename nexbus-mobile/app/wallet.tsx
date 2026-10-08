import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiJson, jsonBody } from "../lib/api";
import { startPayHere } from "../lib/payhere";

type Tx = { id: string; type: "topup" | "booking_payment" | "refund"; amount: number; balance_after: number; note: string | null; created_at: number };
type Wallet = { balance: number; min_topup: number; max_topup: number; transactions: Tx[] };

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (n: number) => `LKR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TX_LABEL: Record<Tx["type"], string> = { topup: "Top-up", booking_payment: "Booking payment", refund: "Refund" };

export default function WalletScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const { ok, data } = await apiJson("/wallet");
    if (mounted.current && ok) setWallet(data);
    if (mounted.current) setLoading(false);
    return ok ? (data as Wallet) : null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    load().catch(() => setLoading(false));
    return () => { mounted.current = false; };
  }, [load]);

  // The balance changes on the server when PayHere's notification arrives. The app only waits for it.
  const waitForBalance = async (before: number) => {
    for (let i = 0; i < 12; i++) {
      const fresh = await load();
      if (fresh && fresh.balance > before) return true;
      await wait(1500);
    }
    return false;
  };

  const handleTopup = async () => {
    const value = Number(amount);
    const min = wallet?.min_topup ?? 100;
    const max = wallet?.max_topup ?? 50000;
    if (!Number.isInteger(value) || value < min || value > max) {
      Alert.alert("Invalid amount", `Enter a whole amount between LKR ${min} and LKR ${max}.`);
      return;
    }
    setBusy(true);
    try {
      const before = wallet?.balance ?? 0;
      const checkout = await apiJson("/wallet/topup", { method: "POST", ...jsonBody({ amount: value }) });
      if (!checkout.ok) {
        Alert.alert("Cannot top up", checkout.data?.error || "Please try again.");
        return;
      }

      let result = await startPayHere(checkout.data);
      if (result === "unavailable") {
        // Expo Go and the web cannot open the PayHere SDK: use the sandbox simulator when the server allows it
        const sim = await apiJson("/payments/simulate", { method: "POST", ...jsonBody({ order_id: checkout.data.order_id }) });
        if (!sim.ok) {
          Alert.alert(
            "PayHere not available here",
            "The PayHere checkout needs a development build of the app. Install it to top up, or ask the administrator to enable the sandbox simulator."
          );
          return;
        }
        result = "completed";
      }

      if (result === "dismissed") { Alert.alert("Top-up cancelled", "No money was added to your wallet."); return; }
      if (result === "error") { Alert.alert("Top-up failed", "The payment could not be completed. No money was added."); return; }

      const credited = await waitForBalance(before);
      if (credited) Alert.alert("Wallet topped up", `${money(value)} was added to your wallet.`);
      else Alert.alert("Processing", "We are waiting for the payment confirmation. Your balance will update in a moment.");
    } catch {
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#1a3cff" style={{ marginTop: 60 }} />
      ) : !wallet ? (
        <Text style={styles.empty}>Could not load your wallet. Please try again.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <Text style={styles.balance}>{money(wallet.balance)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Top up</Text>
          <View style={styles.card}>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.chip, Number(amount) === a && styles.chipActive]}
                  onPress={() => setAmount(String(a))}
                >
                  <Text style={[styles.chipText, Number(amount) === a && styles.chipTextActive]}>{a.toLocaleString("en-US")}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Amount (LKR)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor="#aaa"
              maxLength={6}
            />
            <Text style={styles.hint}>Between LKR {wallet.min_topup} and LKR {wallet.max_topup.toLocaleString("en-US")}</Text>

            <TouchableOpacity onPress={handleTopup} disabled={busy}>
              <LinearGradient
                colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
                style={[styles.payButton, busy && { opacity: 0.5 }]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="card-outline" size={20} color="#fff" />}
                <Text style={styles.payText}>{busy ? "Processing…" : "Top up with PayHere"}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.note}>You pay on PayHere's secure page. NexBus never sees your card details.</Text>
          </View>

          <Text style={styles.sectionTitle}>Transactions</Text>
          {wallet.transactions.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
          ) : (
            <View style={styles.card}>
              {wallet.transactions.map((t, i) => (
                <View key={t.id} style={[styles.txRow, i > 0 && styles.txBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{TX_LABEL[t.type] || t.type}</Text>
                    <Text style={styles.txSub}>
                      {t.note ? `${t.note} · ` : ""}{new Date(t.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: t.amount >= 0 ? "#2e9e4f" : "#d32f2f" }]}>
                    {t.amount >= 0 ? "+" : "−"}{money(Math.abs(t.amount))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },
  balanceCard: { backgroundColor: "#1a1a4e", borderRadius: 16, padding: 22, alignItems: "center", marginBottom: 8 },
  balanceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: "#a9b0ff" },
  balance: { fontSize: 32, fontWeight: "bold", color: "#fff", marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1a1a4e", marginTop: 18, marginBottom: 10 },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f0f0f5", alignItems: "center" },
  chipActive: { backgroundColor: "#1a3cff" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#1a1a4e" },
  chipTextActive: { color: "#fff" },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#1a1a4e", marginBottom: 8 },
  input: { backgroundColor: "#f5f5f5", borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 18, fontWeight: "600", color: "#333" },
  hint: { fontSize: 12, color: "#888", marginTop: 6, marginBottom: 16 },
  payButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 10 },
  payText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  note: { fontSize: 12, color: "#888", textAlign: "center", marginTop: 10 },
  empty: { textAlign: "center", color: "#888", marginTop: 20 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  txBorder: { borderTopWidth: 1, borderTopColor: "#eee" },
  txTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a4e" },
  txSub: { fontSize: 12, color: "#888", marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "bold" },
});
