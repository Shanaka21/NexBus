import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postFix, FIX_INTERVAL_MS, type FixInfo, type SharingMode } from "./trackingCore";

export type { FixInfo, SharingMode };

const TASK = "nexbus-driver-location";
const TRIP_KEY = "nexbus_active_trip_id";

let foreground: Location.LocationSubscription | null = null;

// Background task: keeps sending the latest fix every few seconds while the screen is off.
// The task can run without any screen mounted, so the trip id is read from storage.
TaskManager.defineTask(TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;
  const tripId = await AsyncStorage.getItem(TRIP_KEY);
  if (!tripId) return;
  try {
    await postFix(tripId, data.locations[data.locations.length - 1]);
  } catch {
    /* retried with the next fix */
  }
});

async function startForeground(tripId: string, onFix?: (info: FixInfo) => void) {
  foreground = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: FIX_INTERVAL_MS, distanceInterval: 0 },
    async (loc) => {
      try {
        onFix?.({ status: await postFix(tripId, loc), at: Date.now() });
      } catch {
        onFix?.({ status: 0, at: Date.now() });
      }
    }
  );
}

export async function startSharing(tripId: string, onFix?: (info: FixInfo) => void): Promise<SharingMode> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") throw new Error("PERMISSION");
  await stopSharing();
  await AsyncStorage.setItem(TRIP_KEY, tripId);

  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === "granted") {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: FIX_INTERVAL_MS,
        distanceInterval: 0,
        // Android shows this persistent notification so the driver knows location is being shared
        foregroundService: { notificationTitle: "NexBus", notificationBody: "Sharing bus location for this trip" },
      });
      return "background";
    }
  } catch {
    /* Expo Go and some devices do not support background updates: fall back to the foreground watcher */
  }
  await startForeground(tripId, onFix);
  return "foreground";
}

export async function stopSharing(): Promise<void> {
  foreground?.remove();
  foreground = null;
  await AsyncStorage.removeItem(TRIP_KEY);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    /* task was not running */
  }
}
