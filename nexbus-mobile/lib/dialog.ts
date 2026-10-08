import { Alert, Platform, type AlertButton } from "react-native";

// react-native-web's Alert.alert does nothing, so on the web messages and confirmations would silently vanish.
// This keeps Alert.alert's signature: native uses the real Alert, the web uses the browser's alert/confirm.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  if (!buttons || buttons.length < 2) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Two or more buttons: confirm = the first non-cancel button, otherwise the cancel button runs
  const cancel = buttons.find((b) => b.style === "cancel");
  const action = buttons.find((b) => b.style !== "cancel");
  const label = action?.text ? `\n\nOK = ${action.text}` : "";
  if (window.confirm(text + label)) action?.onPress?.();
  else cancel?.onPress?.();
}
