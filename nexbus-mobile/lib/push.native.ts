import { apiFetch, jsonBody } from "./api";

// Registers this device for push notifications and sends the device (FCM) token to the backend.
// Best effort: push needs a development build with Firebase configured, so failures are ignored
// and the in-app notification list keeps working.
export async function registerForPush(): Promise<void> {
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
    const token = await Notifications.getDevicePushTokenAsync();
    await apiFetch("/users/me", { method: "PATCH", ...jsonBody({ fcm_token: String(token.data) }) });
  } catch {
    /* push is optional */
  }
}
