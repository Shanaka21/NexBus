import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { PROVIDER_GOOGLE } from 'react-native-maps';

export { default, Marker, Polyline } from 'react-native-maps';

// Android already uses Google Maps. On iOS the default is Apple Maps; Google Maps there needs a development
// build (Expo Go does not contain the Google Maps iOS SDK), so ask for it only outside Expo Go.
const inExpoGo = Constants.appOwnership === 'expo';
export const mapProvider = Platform.OS === 'ios' && !inExpoGo ? PROVIDER_GOOGLE : undefined;
