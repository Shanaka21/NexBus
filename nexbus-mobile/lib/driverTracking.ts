import * as Location from "expo-location";
import { postFix, type FixInfo, type SharingMode } from "./trackingCore";

export type { FixInfo, SharingMode };

// Web / foreground implementation: a GPS fix is sent every 10 seconds while the screen is open.
// Native builds use driverTracking.native.ts, which can also keep sharing in the background.
let subscription: Location.LocationSubscription | null = null;

export async function startSharing(tripId: string, onFix?: (info: FixInfo) => void): Promise<SharingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") throw new Error("PERMISSION");
  await stopSharing();
  subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 0 },
    async (loc) => {
      try {
        onFix?.({ status: await postFix(tripId, loc), at: Date.now() });
      } catch {
        onFix?.({ status: 0, at: Date.now() }); // network error: the next fix retries
      }
    }
  );
  return "foreground";
}

export async function stopSharing(): Promise<void> {
  subscription?.remove();
  subscription = null;
}
