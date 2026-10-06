// Stop names are shown in English and Sinhala (NFR-USE)
export function stopLabel(stop: { name: string; nameSi?: string; name_si?: string }): string {
  const si = stop.nameSi || stop.name_si;
  return si ? `${stop.name} · ${si}` : stop.name;
}

export const lkr = (n: number | null | undefined) => `LKR ${Number(n || 0).toLocaleString("en-US")}`;

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function dayTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const day = d.toDateString() === today.toDateString() ? "Today"
    : d.toDateString() === tomorrow.toDateString() ? "Tomorrow"
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return `${day} ${clockTime(ms)}`;
}

// Same meaning of colour everywhere: green on time, amber delayed, red full/cancelled, grey offline
export const LIVE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  on_time:   { label: "ON TIME",   color: "#4caf50", bg: "#e8f5e9" },
  delayed:   { label: "DELAYED",   color: "#ff9800", bg: "#fff3e0" },
  offline:   { label: "OFFLINE",   color: "#9e9e9e", bg: "#eeeeee" },
  scheduled: { label: "SCHEDULED", color: "#1a3cff", bg: "#e3f2fd" },
  idle:      { label: "OFFLINE", color: "#9e9e9e", bg: "#eeeeee" },
};

export function secondsAgo(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  if (seconds < 60) return `updated ${seconds}s ago`;
  return `updated ${Math.round(seconds / 60)} min ago`;
}

export function msAgo(ms: number | null | undefined): string {
  if (!ms) return "no position yet";
  return secondsAgo(Math.max(0, Math.round((Date.now() - ms) / 1000)));
}
