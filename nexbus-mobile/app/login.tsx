import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { API_URL } from "./config";
import { setUserSession } from "./userSession";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.uid) {
        setUserSession(data.uid, data.name, data.email);
        Alert.alert("Success", "Welcome back!", [
          { text: "OK", onPress: () => router.replace("/home") },
        ]);
      } else {
        Alert.alert("Error", "Login failed. Try again.");
      }
    } catch (error) {
      Alert.alert("Error", "Login failed. Check your connection.");
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#f0f0f5" />

      <View style={styles.header}>
        <LinearGradient
          colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
          style={styles.iconBox}
        >
          <Ionicons name="bus" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.appTitle}>NexBus</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome Back</Text>
        <Text style={styles.cardSubtitle}>
          Sign in to manage your NexBus account
        </Text>

        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputBox}>
          <Ionicons
            name="mail-outline"
            size={18}
            color="#aaa"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your e-mail"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputBox}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color="#aaa"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#aaa"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe(!rememberMe)}
          >
            <View
              style={[styles.checkbox, rememberMe && styles.checkboxActive]}
            >
              {rememberMe && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
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

        <View style={styles.divider} />

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
    backgroundColor: "#f0f0f5",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1a3cff",
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a4e",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a4e",
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: "#1a3cff",
    borderColor: "#1a3cff",
  },
  rememberText: { fontSize: 14, color: "#555" },
  forgotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a3cff",
  },
  loginButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  loginText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 20,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  signupText: { fontSize: 14, color: "#888" },
  signupLink: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a3cff",
  },
  footer: {
    marginTop: 24,
    fontSize: 11,
    color: "#aaa",
    letterSpacing: 1,
  },
});
