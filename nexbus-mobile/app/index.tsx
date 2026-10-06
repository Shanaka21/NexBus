import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, StatusBar, Image, Easing, useWindowDimensions } from "react-native";
import { Stack, useRouter } from "expo-router";
import { getUserId, getRole } from "../lib/userSession";

export default function SplashScreen() {
  const [progressAnim] = useState(() => new Animated.Value(0));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const router = useRouter();
  const { width } = useWindowDimensions();

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      // a restored session skips the login screen
      router.replace((getUserId() ? (getRole() === "driver" ? "/driver" : "/home") : "/login") as any);
    });
  }, [fadeAnim, progressAnim, router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Animated.View style={[styles.iconBox, { opacity: fadeAnim }]}>
        <Image source={require("../assets/images/logo.png")} style={styles.logo} />
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.subtitle}>Track your bus in real time</Text>
      </Animated.View>

      <View style={styles.progressContainer}>
        <View style={[styles.track, { width: Math.min(width - 80, 320) }]}>
          <Animated.View
            style={[
              styles.fill,
              { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
            ]}
          />
        </View>
        <Text style={styles.initText}>INITIALIZING SYSTEM...</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2026 NEXBUS SYSTEMS INC.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  logo: { width: 260, height: 145, resizeMode: "contain" },
  subtitle: {
    fontSize: 16,
    color: "#5b6478",
    textAlign: "center",
    marginTop: 0,
    marginBottom: 36,
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e3e8f5",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#1a3cff",
  },
  initText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0d1b6e",
    letterSpacing: 1.5,
    marginTop: 14,
  },
  footer: {
    position: "absolute",
    bottom: 40,
  },
  footerText: {
    fontSize: 11,
    color: "#8a93a8",
    letterSpacing: 2,
  },
});
