import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";
import { getUserId, getUserName, getUserEmail, getRole, getOperatorId, getRefreshToken, setUserSession, onSessionCleared } from "./userSession";

const KEY = "nexbus_session";

// "Remember me": keeps who is signed in plus the refresh token (never the password or the short-lived ID token)
export async function saveSession(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!getUserId() || !refreshToken) return;
  await AsyncStorage.setItem(KEY, JSON.stringify({
    uid: getUserId(), name: getUserName(), email: getUserEmail(), role: getRole(), operatorId: getOperatorId(), refreshToken,
  }));
}

export const forgetSession = () => AsyncStorage.removeItem(KEY).catch(() => {});

// Restores a remembered session at app start. Returns true when the user is signed in again.
export async function restoreSession(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: saved.refreshToken }),
    });
    const data = res.ok ? await res.json() : null;
    if (!data?.idToken) { await forgetSession(); return false; }

    setUserSession(saved.uid, saved.name, saved.email, {
      role: saved.role, operatorId: saved.operatorId, idToken: data.idToken, refreshToken: data.refreshToken,
    });
    return true;
  } catch {
    return false;
  }
}

onSessionCleared(() => { forgetSession(); });
