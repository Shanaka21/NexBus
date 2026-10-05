import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiFetch, jsonBody } from "./api";

// Registers this device for push notifications and sends its Expo push token to the backend, which
// delivers pushes through Expo's push service (https://exp.host) rather than talking to FCM/APNs directly.
// Best effort: push needs a development/production build, so failures are ignored and the in-app
// notification list keeps working.
export async function registerForPush(): Promise<void> {
  // Expo Go on Android no longer supports remote push (SDK 53+); loading the module there only logs an error
  if (Platform.OS === "android" && Constants.appOwnership === "expo") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiFetch("/users/me", { method: "PATCH", ...jsonBody({ push_token: token.data }) });
  } catch {
    /* push is optional */
  }
}
