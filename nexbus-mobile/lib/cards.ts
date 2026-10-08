export type CardBrand = "VISA" | "MASTER" | "AMEX";

export const digitsOnly = (s: string) => s.replace(/\D/g, "");

export function detectBrand(number: string): CardBrand | null {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]|[3-6]|7[01]|720))/.test(n)) return "MASTER";
  if (/^3[47]/.test(n)) return "AMEX";
  return null;
}

// Luhn checksum: catches typing mistakes before anything is sent anywhere
export function luhnValid(number: string): boolean {
  const n = digitsOnly(number);
  if (n.length < 12) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// 4-4-4-4 for most cards, 4-6-5 for Amex
export function formatCardNumber(number: string): string {
  const n = digitsOnly(number);
  if (detectBrand(n) === "AMEX") {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(" ");
  }
  return (n.slice(0, 16).match(/.{1,4}/g) || []).join(" ");
}

export function formatExpiry(input: string): string {
  const n = digitsOnly(input).slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
}

// "MM/YY" that is a real month and not already past
export function expiryValid(expiry: string): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}
