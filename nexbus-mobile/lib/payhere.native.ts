export type PayHereResult = "completed" | "dismissed" | "error" | "unavailable";

// Opens the PayHere hosted checkout through the official SDK. The SDK contains native code,
// so it only works in a development/production build, not in Expo Go. In that case "unavailable" is returned.
export async function startPayHere(paymentObject: Record<string, unknown>): Promise<PayHereResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@payhere/payhere-mobilesdk-reactnative");
    const PayHere = sdk.default ?? sdk;
    if (!PayHere || typeof PayHere.startPayment !== "function") return "unavailable";
    return await new Promise<PayHereResult>((resolve) => {
      PayHere.startPayment(
        paymentObject,
        () => resolve("completed"),
        () => resolve("error"),
        () => resolve("dismissed")
      );
    });
  } catch {
    return "unavailable";
  }
}
