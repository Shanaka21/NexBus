import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';

export default function App() {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    ]).start();
  }, [fadeAnim, progressAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0f0f5" />
      <Animated.View style={[styles.iconBox, { opacity: fadeAnim }]}>
        <Text style={styles.busIcon}>🚌</Text>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>NexBus</Text>
        <Text style={styles.subtitle}>Track your bus in real time</Text>
      </Animated.View>

      <View style={styles.progressContainer}>
        <Text style={styles.initText}>INITIALIZING SYSTEM...</Text>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, {
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%']
            })
          }]} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>📍 LIVE TRANSIT DATA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconBox: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0ef',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  busIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a1a4e',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  initText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a4e',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#d0d0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1a1a4e',
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    fontSize: 11,
    color: '#999',
    letterSpacing: 2,
  },
});