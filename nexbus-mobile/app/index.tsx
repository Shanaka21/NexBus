import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, StatusBar } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function SplashScreen() {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]).start(() => {
      router.replace("/login");
    });
  }, [fadeAnim, progressAnim, router]);

  return (
    <LinearGradient
      colors={["#4f86f7", "#1a3cff", "#0d1b6e"]}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#1a3cff" />
      <Animated.View style={[styles.iconBox, { opacity: fadeAnim }]}>
        <Ionicons name="bus" size={72} color="#fff" />
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>NexBus</Text>
        <Text style={styles.subtitle}>Track your bus in real time</Text>
      </Animated.View>

      <View style={styles.progressContainer}>
        <Text style={styles.initText}>INITIALIZING SYSTEM...</Text>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>📍 LIVE TRANSIT DATA</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  /*iconBox: {
    width: 100,
    height: 100,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },*/
  iconBox: {
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 48,
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
  },
  initText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  footer: {
    position: "absolute",
    bottom: 40,
  },
  footerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 2,
  },
});
