// Web fallback: react-native-maps is native-only and breaks the web bundle.
import React from 'react';
import { View, Text } from 'react-native';

export default function MapView({ style }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb' }, style]}>
      <Text>Map is available on iOS and Android only</Text>
    </View>
  );
}

export function Marker() {
  return null;
}

export function Polyline() {
  return null;
}

export const mapProvider = undefined;
