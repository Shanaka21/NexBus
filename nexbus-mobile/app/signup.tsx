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

export default function SignupScreen() {
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
    } catch (error) {
      Alert.alert("Error", "Signup failed. Check your connection.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#f0f0f5" />

      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
          style={styles.iconBox}
        >
          <Ionicons name="bus" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.appTitle}>NexBus</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Account</Text>
        <Text style={styles.cardSubtitle}>
          Sign up to start tracking your bus
        </Text>

        {/* Name */}
        <Text style={styles.label}>Full Name</Text>
        <View style={styles.inputBox}>
          <Ionicons
            name="person-outline"
            size={18}
            color="#aaa"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor="#aaa"
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Email */}
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
            placeholder="Enter your email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Password */}
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
            placeholder="Create a password"
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

        {/* Confirm Password */}
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputBox}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color="#aaa"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        {/* Signup Button */}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Login */}
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/login")}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>© 2026 NEXBUS SYSTEMS INC.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f0f0f5",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  signupButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  signupButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 20,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginText: {
    fontSize: 14,
    color: "#888",
  },
  loginLink: {
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
