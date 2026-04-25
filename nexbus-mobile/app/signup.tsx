import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "./config";
import { setUserSession } from "./userSession";
import { useTheme } from "./themeContext";

const light = {
  bg:        "#f0f0f5",
  card:      "#fff",
  text:      "#1a1a4e",
  inputBg:   "#f5f5f5",
  inputText: "#333",
  divider:   "#eee",
};

const dark = {
  bg:        "#0d0d1a",
  card:      "#1a1a2e",
  text:      "#dde0ff",
  inputBg:   "#1e2250",
  inputText: "#dde0ff",
  divider:   "#2a2a4e",
};

export default function SignupScreen() {
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (data.uid) {
        setUserSession(data.uid, name, email);
        Alert.alert("Success", "Account created!", [
          { text: "OK", onPress: () => router.replace("/home") },
        ]);
      } else {
        Alert.alert("Error", data.error || "Signup failed");
      }
    } catch {
      Alert.alert("Error", "Signup failed. Check your connection.");
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={p.bg} />

      <View style={styles.header}>
        <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.iconBox}>
          <Ionicons name="bus" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.appTitle}>NexBus</Text>
      </View>

      <View style={[styles.card, { backgroundColor: p.card }]}>
        <Text style={[styles.cardTitle, { color: p.text }]}>Create Account</Text>
        <Text style={styles.cardSubtitle}>Sign up to start tracking your bus</Text>

        <Text style={[styles.label, { color: p.text }]}>Full Name</Text>
        <View style={[styles.inputBox, { backgroundColor: p.inputBg }]}>
          <Ionicons name="person-outline" size={18} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: p.inputText }]}
            placeholder="Your full name"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
          />
        </View>

        <Text style={[styles.label, { color: p.text }]}>Email Address</Text>
        <View style={[styles.inputBox, { backgroundColor: p.inputBg }]}>
          <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: p.inputText }]}
            placeholder="Enter your email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={[styles.label, { color: p.text }]}>Password</Text>
        <View style={[styles.inputBox, { backgroundColor: p.inputBg }]}>
          <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: p.inputText }]}
            placeholder="Create a password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: p.text }]}>Confirm Password</Text>
        <View style={[styles.inputBox, { backgroundColor: p.inputBg }]}>
          <Ionicons name="lock-closed-outline" size={18} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: p.inputText }]}
            placeholder="Confirm Password"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity onPress={handleSignup}>
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={styles.signupButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.signupButtonText}>Create Account →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: p.divider }]} />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>© 2026 NEXBUS SYSTEMS INC.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header:   { alignItems: "center", marginBottom: 24 },
  iconBox:  { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  appTitle: { fontSize: 26, fontWeight: "bold", color: "#1a3cff" },

  card:        { width: "100%", borderRadius: 20, padding: 24 },
  cardTitle:   { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  cardSubtitle:{ fontSize: 14, color: "#888", marginBottom: 24 },

  label:    { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  inputBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, height: 52 },
  inputIcon:{ marginRight: 10 },
  input:    { flex: 1, fontSize: 15 },

  signupButton:    { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  signupButtonText:{ color: "#fff", fontSize: 17, fontWeight: "bold" },

  divider:  { height: 1, marginVertical: 20 },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText:{ fontSize: 14, color: "#888" },
  loginLink:{ fontSize: 14, fontWeight: "bold", color: "#1a3cff" },

  footer: { marginTop: 24, fontSize: 11, color: "#aaa", letterSpacing: 1 },
});
