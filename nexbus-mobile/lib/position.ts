import * as Location from "expo-location";

// Last known position, only when the passenger allows it: lets "I want to go to X" work without naming an origin
export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const loc = await Location.getLastKnownPositionAsync();
    return loc ? { lat: loc.coords.latitude, lng: loc.coords.longitude } : null;
  } catch {
    return null;
  }
}
