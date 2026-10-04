import { Alert, Platform } from "react-native";

// React Native's Alert.alert does nothing on the web, so error messages and confirmation prompts never appeared.
// This maps it to the browser dialogs. Native builds keep the real Alert.
if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title: string, message?: string, buttons?: any[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");

    if (!buttons || buttons.length === 0) { window.alert(text); return; }
    if (buttons.length === 1) { window.alert(text); buttons[0].onPress?.(); return; }

    // Several buttons: the cancel button declines, the first other button confirms.
    // With more than one confirming action the choices are offered as a numbered prompt.
    const cancel = buttons.find((b) => b.style === "cancel");
    const actions = buttons.filter((b) => b !== cancel);
    if (actions.length === 1) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel?.onPress?.();
      return;
    }
    const menu = actions.map((b, i) => `${i + 1}. ${b.text}`).join("\n");
    const answer = window.prompt(`${text}\n\n${menu}\n\nEnter a number (or leave empty to cancel)`);
    const chosen = actions[Number(answer) - 1];
    if (chosen) chosen.onPress?.();
    else cancel?.onPress?.();
  };
}
