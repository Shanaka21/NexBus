import { Platform } from 'react-native';

// Web runs on this PC, so localhost works. A physical phone must use the PC's LAN IP.
const LAN_IP = '192.168.70.122';

export const API_URL = Platform.OS === 'web' ? 'http://localhost:5000' : `http://${LAN_IP}:5000`;
