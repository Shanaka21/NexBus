import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "./config";
import { setUserSession } from "./userSession";
import { useTheme } from "./themeContext";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  "188813305489-dst6dcu1lrjbgofbqno058kah5biti76.apps.googleusercontent.com";

function GoogleLogo() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const light = {
  bg:          "#f0f0f5",
  card:        "#fff",
  text:        "#1a1a4e",
  inputBg:     "#f5f5f5",
  inputText:   "#333",
  divider:     "#eee",
  googleBg:    "#fff",
  googleBorder:"#e0e0e0",
  googleText:  "#333",
  rememberText:"#555",
};

const dark = {
  bg:          "#0d0d1a",
  card:        "#1a1a2e",
  text:        "#dde0ff",
  inputBg:     "#1e2250",
  inputText:   "#dde0ff",
  divider:     "#2a2a4e",
  googleBg:    "#1a1a2e",
  googleBorder:"#2a2a4e",
  googleText:  "#dde0ff",
  rememberText:"#aaa",
};

export default function LoginScreen() {
  const { isDark } = useTheme();
  const p = isDark ? dark : light;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: "188813305489-nh13sfaubns6j74ggju7rn4lrt385nj7.apps.googleusercontent.com",
  });

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.accessToken;
      if (!token) return;
      setGoogleLoading(true);
      fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((user) => {
          setUserSession(user.id, user.name || "User", user.email || "");
          router.replace("/home");
        })
        .catch(() => Alert.alert("Error", "Could not fetch Google profile."))
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === "error") {
      Alert.alert("Error", "Google Sign-In failed. Please try again.");
    }
  }, [response, router]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.uid) {
        setUserSession(data.uid, data.name, data.email);
        router.replace("/home");
      } else {
        Alert.alert("Error", data.error || "Login failed. Try again.");
      }
    } catch {
      Alert.alert("Error", "Login failed. Check your connection.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: p.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={p.bg} />

      <View style={styles.header}>
        <LinearGradient colors={["#4f86f7", "#1a3cff", "#0d1b6e"]} style={styles.iconBox}>
          <Ionicons name="bus" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.appTitle}>NexBus</Text>
      </View>

      <View style={[styles.card, { backgroundColor: p.card }]}>
        <Text style={[styles.cardTitle, { color: p.text }]}>Welcome Back</Text>
        <Text style={styles.cardSubtitle}>Sign in to manage your NexBus account</Text>

        <Text style={[styles.label, { color: p.text }]}>Email Address</Text>
        <View style={[styles.inputBox, { backgroundColor: p.inputBg }]}>
          <Ionicons name="mail-outline" size={18} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: p.inputText }]}
            placeholder="Enter your e-mail"
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
            placeholder="Enter your password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#aaa" />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={[styles.rememberText, { color: p.rememberText }]}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogin}>
          <LinearGradient
            colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
            style={styles.loginButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.loginText}>Log in →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.orRow}>
          <View style={[styles.orLine, { backgroundColor: p.divider }]} />
          <Text style={styles.orText}>or continue with</Text>
          <View style={[styles.orLine, { backgroundColor: p.divider }]} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: p.googleBg, borderColor: p.googleBorder }, (!request || googleLoading) && { opacity: 0.6 }]}
          onPress={() => promptAsync()}
          disabled={!request || googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color="#888" />
          ) : (
            <GoogleLogo />
          )}
          <Text style={[styles.googleText, { color: p.googleText }]}>
            {googleLoading ? "Signing in…" : "Sign in with Google"}
          </Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: p.divider }]} />

        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account yet? </Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={styles.signupLink}>Sign up for free</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>© 2026 NEXBUS SYSTEMS INC.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  header:   { alignItems: "center", marginBottom: 24 },
  iconBox:  { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  appTitle: { fontSize: 26, fontWeight: "bold", color: "#1a3cff" },

  card:        { width: "100%", borderRadius: 20, padding: 24 },
  cardTitle:   { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  cardSubtitle:{ fontSize: 14, color: "#888", marginBottom: 18 },

  label:    { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  inputBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 14, marginBottom: 20, height: 52 },
  inputIcon:{ marginRight: 10 },
  input:    { flex: 1, fontSize: 15 },

  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  rememberRow: { flexDirection: "row", alignItems: "center" },
  checkbox:    { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#aaa", alignItems: "center", justifyContent: "center", marginRight: 8 },
  checkboxActive: { backgroundColor: "#1a3cff", borderColor: "#1a3cff" },
  rememberText:{ fontSize: 14 },
  forgotText:  { fontSize: 14, fontWeight: "600", color: "#1a3cff" },

  loginButton: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 20 },
  loginText:   { color: "#fff", fontSize: 17, fontWeight: "bold" },

  orRow:  { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 10 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, color: "#aaa", fontWeight: "500" },

  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, gap: 10, marginBottom: 20 },
  googleText:   { fontSize: 15, fontWeight: "600" },

  divider:   { height: 1, marginBottom: 16 },
  signupRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap" },
  signupText:{ fontSize: 14, color: "#888" },
  signupLink:{ fontSize: 14, fontWeight: "bold", color: "#1a3cff" },

  footer: { marginTop: 24, fontSize: 11, color: "#aaa", letterSpacing: 1 },
});
