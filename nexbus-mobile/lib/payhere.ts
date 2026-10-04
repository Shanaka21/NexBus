export type PayHereResult = "completed" | "dismissed" | "error" | "unavailable";

// The PayHere mobile SDK is native only; on the web the sandbox simulator is used instead.
export async function startPayHere(_paymentObject: Record<string, unknown>): Promise<PayHereResult> {
  return "unavailable";
}
