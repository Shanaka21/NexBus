import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Fallback only: the PC's LAN IP changes with the network, so it is normally taken from the Expo dev server
const LAN_IP = '192.168.70.102';

// While developing, Expo knows the PC's address (e.g. "192.168.1.5:8081"); the API runs on the same PC
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

// A deployed API (EXPO_PUBLIC_API_URL, e.g. https://api.example.com) wins; this is how a standalone APK reaches a public server
const PUBLIC_API = process.env.EXPO_PUBLIC_API_URL;

export const API_URL = PUBLIC_API || (Platform.OS === 'web'
  ? 'http://localhost:5000'
  : `http://${devHost || LAN_IP}:5000`);
