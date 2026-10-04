import type { LocationObject } from "expo-location";
import { apiFetch, jsonBody } from "./api";

export type FixInfo = { status: number; at: number };
export type SharingMode = "background" | "foreground";

// Sends one GPS fix to the API exactly as the design specifies (lat, lng, speed, heading, accuracy)
export async function postFix(tripId: string, loc: LocationObject): Promise<number> {
  const res = await apiFetch("/location", {
    method: "POST",
    ...jsonBody({
      trip_id: tripId,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed_kmh: Math.max(0, (loc.coords.speed ?? 0) * 3.6),
      heading: Math.min(360, Math.max(0, loc.coords.heading ?? 0)),
      accuracy_m: loc.coords.accuracy ?? 999,
    }),
  });
  return res.status;
}
