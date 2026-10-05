import React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';

export { default, Marker, Polyline } from 'react-native-maps';

// Android already uses Google Maps. On iOS the default is Apple Maps; Google Maps there needs a development
// build (Expo Go does not contain the Google Maps iOS SDK), so ask for it only outside Expo Go.
const inExpoGo = Constants.appOwnership === 'expo';
export const mapProvider = Platform.OS === 'ios' && !inExpoGo ? PROVIDER_GOOGLE : undefined;

// Expo Go on Android cannot receive this app's Google Maps key (app.json plugins only apply to real builds),
// so Google's base tiles stay blank there. In that one case the base map is hidden and OpenStreetMap tiles
// are drawn instead; development and production builds keep using Google tiles.
const osmFallback = Platform.OS === 'android' && inExpoGo;
export const baseMapType = osmFallback ? 'none' : 'standard';

export function BaseTiles() {
  if (!osmFallback) return null;
  return <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} zIndex={-1} />;
}
